/**
 * Vocabulario clave de una misión.
 *
 * Se genera una vez por misión (una llamada al modelo) y se reutiliza con
 * todos los alumnos, como la introducción. La regla es estricta: **siempre 5
 * palabras**; si el modelo trae de más se recorta y si trae de menos se
 * reintenta.
 */
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { mission_vocabulary, type VocabularyWord } from '../../db/schema.ts'
import { AIProviderError, completeChat } from '../../lib/ai.ts'
import { HttpError } from '../../utils/http-error.ts'
import { findIntroductionByMission, getMissionById } from '../introductions/service.ts'
import {
  buildVocabularyPrompt,
  VOCABULARY_SCHEMA,
  type VocabularyScene,
  type VocabularySource,
} from './prompts.ts'

export type VocabularyRow = typeof mission_vocabulary.$inferSelect

/** El requisito es exacto: ni 4, ni 6. */
export const REQUIRED_WORDS = 5
/** Intentos de generación antes de rendirse. */
const MAX_ATTEMPTS = 2

export interface VocabularyPayload {
  id: string
  mission_id: string
  version: number
  words: VocabularyWord[]
}

export async function findVocabularyByMission(missionId: string): Promise<VocabularyRow | null> {
  const [row] = await db
    .select()
    .from(mission_vocabulary)
    .where(eq(mission_vocabulary.mission_id, missionId))
    .limit(1)
  return row ?? null
}

/** Convierte la fila en la respuesta de la API. */
function toPayload(row: VocabularyRow): VocabularyPayload {
  return {
    id: row.id,
    mission_id: row.mission_id,
    version: row.version,
    words: row.words,
  }
}

/**
 * Valida la respuesta del modelo.
 *
 * La salida estructurada garantiza claves y tipos, pero no cuántas palabras
 * trae ni si sirven: aquí se normaliza (palabra, traducción, ejemplo y
 * traducción del ejemplo), se exige el 5 exacto y se rechazan repetidas.
 * Devuelve null cuando hay que reintentar.
 */
export function validateWords(raw: unknown): VocabularyWord[] | null {
  const words = (raw as { words?: unknown } | null)?.words
  if (!Array.isArray(words)) return null

  const clean: VocabularyWord[] = []
  const seenWords = new Set<string>()
  const seenTranslations = new Set<string>()

  for (const item of words) {
    const entry = item as Partial<VocabularyWord> | null
    const word = String(entry?.word ?? '').trim().toLowerCase()
    const translation = String(entry?.translation ?? '').trim()
    const example = String(entry?.example ?? '').trim()
    const exampleTranslation = String(entry?.example_translation ?? '').trim()

    if (!word || !translation || !example || !exampleTranslation) return null
    // Repetir una palabra o un significado dejaría la actividad coja.
    if (seenWords.has(word)) return null
    if (seenTranslations.has(translation.toLowerCase())) return null
    seenWords.add(word)
    seenTranslations.add(translation.toLowerCase())

    clean.push({ word, translation, example, example_translation: exampleTranslation })
  }

  // De más se recorta; de menos no hay nada que recortar.
  if (clean.length < REQUIRED_WORDS) return null
  return clean.slice(0, REQUIRED_WORDS)
}

function toSource(mission: NonNullable<Awaited<ReturnType<typeof getMissionById>>>): VocabularySource {
  return {
    missionId: mission.id,
    title: mission.title,
    description: mission.description,
    objective: mission.objective,
    sceneContext: mission.scene_context,
    characterName: mission.character_name,
    cefrLevel: mission.cefr_level,
    exampleConversation: mission.example_conversation,
    expectedOutcome: mission.expected_outcome_indicator,
  }
}

function toScene(introduction: Awaited<ReturnType<typeof findIntroductionByMission>>): VocabularyScene | null {
  if (!introduction) return null

  // El id de la línea (A/B) apunta a un personaje; saber cuál es del alumno
  // permite pedirle al modelo las palabras que él tendrá que producir.
  const studentIds = new Set(
    introduction.characters.filter(character => character.played_by === 'student').map(character => character.id),
  )

  return {
    title: introduction.scene_title,
    description: introduction.scene_description,
    lines: introduction.lines.map(line => ({
      speaker: studentIds.has(line.speaker) ? ('student' as const) : ('ai' as const),
      text: line.text,
      translation: line.translation,
    })),
    expressions: introduction.useful_expressions,
  }
}

/** Genera y valida las 5 palabras; reintenta una vez si no cumplen. */
async function generateWords(
  source: VocabularySource,
  scene: VocabularyScene | null,
): Promise<VocabularyWord[]> {
  let lastError = 'sin respuesta'

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let content: string
    try {
      content = await completeChat({
        messages: [{ role: 'user', content: buildVocabularyPrompt(source, scene) }],
        schema: VOCABULARY_SCHEMA,
        maxTokens: 1400,
      })
    } catch (err) {
      // El proveedor caído no es un error inesperado del backend: 502.
      if (err instanceof AIProviderError) {
        throw new HttpError(502, 'El proveedor de IA no respondió')
      }
      throw err
    }

    try {
      const valid = validateWords(JSON.parse(content))
      if (valid) return valid
      lastError = 'no trajo exactamente 5 palabras utilizables'
    } catch {
      lastError = 'respuesta ilegible'
    }
    console.warn(`[vocabulary] Intento ${attempt} descartado: ${lastError}`)
  }

  // Es un fallo del proveedor, no del backend.
  throw new HttpError(502, `El vocabulario generado no es utilizable (${lastError})`)
}

/**
 * Vocabulario de la misión: de caché o generado al vuelo.
 *
 * Dos alumnos pueden pedirlo a la vez: el primero escribe y el otro devuelve lo
 * que ya estaba en vez de duplicar la generación.
 */
export async function getOrCreateVocabulary(missionId: string): Promise<VocabularyPayload> {
  const stored = await findVocabularyByMission(missionId)
  if (stored) return toPayload(stored)

  const mission = await getMissionById(missionId)
  if (!mission) throw new HttpError(404, 'Mission not found')

  const scene = toScene(await findIntroductionByMission(missionId))
  const words = await generateWords(toSource(mission), scene)

  const [row] = await db
    .insert(mission_vocabulary)
    .values({
      id: randomUUID(),
      mission_id: mission.id,
      words,
      generated_by: 'anthropic',
      version: 1,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .onConflictDoNothing({ target: [mission_vocabulary.mission_id] })
    .returning()

  if (row) return toPayload(row)

  const raced = await findVocabularyByMission(missionId)
  if (!raced) throw new HttpError(500, 'No se pudo guardar el vocabulario')
  return toPayload(raced)
}

/** Regenera el vocabulario (solo docentes) y suma la versión. */
export async function regenerateVocabulary(missionId: string): Promise<VocabularyPayload> {
  const mission = await getMissionById(missionId)
  if (!mission) throw new HttpError(404, 'Mission not found')

  const stored = await findVocabularyByMission(missionId)
  const nextVersion = (stored?.version ?? 0) + 1
  const scene = toScene(await findIntroductionByMission(missionId))
  const words = await generateWords(toSource(mission), scene)

  const [row] = await db
    .insert(mission_vocabulary)
    .values({
      id: randomUUID(),
      mission_id: mission.id,
      words,
      generated_by: 'anthropic',
      version: nextVersion,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: [mission_vocabulary.mission_id],
      set: {
        words,
        generated_by: 'anthropic',
        version: nextVersion,
        updated_at: new Date(),
      },
    })
    .returning()

  if (!row) throw new HttpError(500, 'El upsert del vocabulario no devolvió la fila')
  return toPayload(row)
}
