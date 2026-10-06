/**
 * Lógica de dominio de las introducciones narrativas.
 *
 * La generación es cara (una llamada al modelo), así que se genera una vez por
 * misión y se reutiliza para todos los alumnos. Regenerar es una acción
 * explícita y exclusiva de docentes.
 */
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { MissionIntroduction } from '@vox/shared'
import { AIProviderError, completeChat } from '../../lib/ai.ts'
import { db } from '../../db/client.ts'
import { missions, mission_introductions } from '../../db/schema.ts'
import { HttpError } from '../../utils/http-error.ts'
import { sanitizeBackdrop } from './backdrop.ts'
import { buildIntroductionPrompt, INTRODUCTION_SCHEMA, type IntroductionSource } from './prompts.ts'

export type IntroductionRow = typeof mission_introductions.$inferSelect

/** Límites que el modelo no garantiza por sí solo (los minItems no se aplican). */
const MIN_LINES = 4
const MAX_LINES = 8
const MIN_EXPRESSIONS = 3
const MAX_EXPRESSIONS = 5

export async function findIntroductionByMission(missionId: string): Promise<IntroductionRow | null> {
  const [row] = await db
    .select()
    .from(mission_introductions)
    .where(eq(mission_introductions.mission_id, missionId))
    .limit(1)

  return row ?? null
}

export async function getMissionById(missionId: string): Promise<typeof missions.$inferSelect | null> {
  const [mission] = await db.select().from(missions).where(eq(missions.id, missionId)).limit(1)
  return mission ?? null
}

/**
 * Valida la escena que devuelve el modelo.
 *
 * La salida estructurada garantiza claves y tipos, pero NO garantiza cuántos
 * personajes, líneas ni expresiones trae: eso se comprueba aquí.
 */
function validateIntroduction(raw: MissionIntroduction): MissionIntroduction {
  const characters = raw.characters ?? []
  if (characters.length !== 2) throw new Error(`La escena necesita 2 personajes y trae ${characters.length}`)

  const aiCharacters = characters.filter(character => character.played_by === 'ai')
  const studentCharacters = characters.filter(character => character.played_by === 'student')
  if (aiCharacters.length !== 1 || studentCharacters.length !== 1) {
    throw new Error('La escena necesita exactamente un personaje de IA y uno del alumno')
  }

  const lines = raw.lines ?? []
  if (lines.length < MIN_LINES || lines.length > MAX_LINES) {
    throw new Error(`La escena necesita entre ${MIN_LINES} y ${MAX_LINES} líneas y trae ${lines.length}`)
  }
  for (const line of lines) {
    if (!line.text?.trim() || !line.translation?.trim()) {
      throw new Error('Hay líneas sin texto o sin traducción')
    }
  }

  const expressions = raw.useful_expressions ?? []
  if (expressions.length < MIN_EXPRESSIONS || expressions.length > MAX_EXPRESSIONS) {
    throw new Error(`Las expresiones deben ser entre ${MIN_EXPRESSIONS} y ${MAX_EXPRESSIONS} y hay ${expressions.length}`)
  }

  if (!raw.scene_title?.trim() || !raw.scene_description?.trim()) {
    throw new Error('La escena no tiene título o descripción')
  }

  // Un género raro se descarta (el avatar cae a su variante neutra) y el fondo
  // tampoco bloquea: si viene mal, el frontend usa el respaldo por palabras clave.
  const sanitizedCharacters = raw.characters.map(character => ({
    ...character,
    gender: character.gender === 'male' || character.gender === 'female' ? character.gender : undefined,
  }))

  return { ...raw, characters: sanitizedCharacters, backdrop: sanitizeBackdrop(raw.backdrop) }
}

/** Datos de la misión que alimentan la generación. */
function toSource(mission: typeof missions.$inferSelect): IntroductionSource {
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

/**
 * Genera la escena con el modelo y la valida.
 *
 * Lanza `HttpError(502)` cuando el modelo no devuelve una escena utilizable:
 * es un fallo del proveedor, no del backend.
 */
export async function generateIntroduction(source: IntroductionSource): Promise<MissionIntroduction> {
  let content: string
  try {
    content = await completeChat({
      messages: [{ role: 'user', content: buildIntroductionPrompt(source) }],
      schema: INTRODUCTION_SCHEMA,
      maxTokens: 1600,
    })
  } catch (err) {
    // El proveedor caído no es un error inesperado del backend: 502.
    if (err instanceof AIProviderError) {
      throw new HttpError(502, 'El proveedor de IA no respondió')
    }
    throw err
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new HttpError(502, 'El modelo devolvió una escena ilegible')
  }

  try {
    return validateIntroduction(parsed as MissionIntroduction)
  } catch (err) {
    console.error('[introductions] Escena inválida:', (err as Error).message)
    throw new HttpError(502, 'La escena generada no es utilizable')
  }
}

export async function getOrCreateIntroduction(missionId: string): Promise<IntroductionRow> {
  const stored = await findIntroductionByMission(missionId)
  if (stored?.is_published) return stored

  const mission = await getMissionById(missionId)
  if (!mission) throw new HttpError(404, 'Mission not found')

  return createIntroductionRow(mission, 1)
}

/** Inserta la escena generada; si otro proceso ganó la carrera, devuelve esa. */
async function createIntroductionRow(
  mission: typeof missions.$inferSelect,
  version: number,
): Promise<IntroductionRow> {
  const introduction = await generateIntroduction(toSource(mission))

  const [row] = await db
    .insert(mission_introductions)
    .values({
      id: randomUUID(),
      mission_id: mission.id,
      scene_title: introduction.scene_title,
      scene_description: introduction.scene_description,
      characters: introduction.characters,
      lines: introduction.lines,
      useful_expressions: introduction.useful_expressions,
      backdrop: introduction.backdrop ?? null,
      generated_by: 'anthropic',
      version,
      created_at: new Date(),
      updated_at: new Date(),
    })
    // Dos alumnos pueden pedir la escena a la vez: gana el primero y el otro
    // devuelve la que ya estaba guardada en vez de duplicar la generación.
    .onConflictDoNothing({ target: [mission_introductions.mission_id] })
    .returning()

  if (row) return row
  return (await findIntroductionByMission(mission.id)) ?? (await getOrCreateIntroduction(mission.id))
}

/**
 * Regenera la escena (sólo docentes): sustituye la guardada y suma la versión.
 */
export async function regenerateIntroduction(missionId: string): Promise<IntroductionRow> {
  const mission = await getMissionById(missionId)
  if (!mission) throw new HttpError(404, 'Mission not found')

  const stored = await findIntroductionByMission(missionId)
  const nextVersion = (stored?.version ?? 0) + 1

  const introduction = await generateIntroduction(toSource(mission))

  const [row] = await db
    .insert(mission_introductions)
    .values({
      id: randomUUID(),
      mission_id: mission.id,
      scene_title: introduction.scene_title,
      scene_description: introduction.scene_description,
      characters: introduction.characters,
      lines: introduction.lines,
      useful_expressions: introduction.useful_expressions,
      backdrop: introduction.backdrop ?? null,
      generated_by: 'anthropic',
      version: nextVersion,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: [mission_introductions.mission_id],
      set: {
        scene_title: introduction.scene_title,
        scene_description: introduction.scene_description,
        characters: introduction.characters,
        lines: introduction.lines,
        useful_expressions: introduction.useful_expressions,
        backdrop: introduction.backdrop ?? null,
        generated_by: 'anthropic',
        version: nextVersion,
        updated_at: new Date(),
      },
    })
    .returning()

  if (!row) throw new Error('El upsert de la introducción no devolvió la fila')
  return row
}
