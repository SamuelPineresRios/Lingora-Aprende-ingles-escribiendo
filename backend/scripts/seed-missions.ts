/**
 * Siembra las misiones y su contenido desde `scripts/fixtures/`.
 *
 *   npm run missions:seed -w @vox/backend
 *   npm run missions:seed -w @vox/backend -- --no-prewarm
 *
 * Es idempotente: inserta lo que falta y actualiza lo existente, así que sirve
 * tanto para levantar el proyecto desde cero como para restaurar el contenido
 * si se pierde la base de datos.
 *
 * - `missions.json` es el catálogo de misiones (se generan con
 *   `missions:generate`, pero esa generación no es determinista).
 * - `introductions.json` y `vocabulary.json` son contenido escrito a mano
 *   (determinista): escena narrativa y palabras clave que siembran directo,
 *   sin modelo, para que el alumno las cargue al instante.
 *
 * Lo que no venga en fixture se precalienta con el modelo al final (se omite
 * con `--no-prewarm`).
 */
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { CefrLevel, IntroductionCharacter, IntroductionLine, MissionBackdrop } from '@vox/shared'
import { db, sql } from '../src/db/client.ts'
import { mission_introductions, mission_vocabulary, missions } from '../src/db/schema.ts'
import { prewarmMissingContent } from './lib/prewarm-content.ts'

const FIXTURES = path.join(import.meta.dirname, 'fixtures')
const MISSION_FIXTURE = path.join(FIXTURES, 'missions.json')
const INTRO_FIXTURE = path.join(FIXTURES, 'introductions.json')
const VOCAB_FIXTURE = path.join(FIXTURES, 'vocabulary.json')

interface MissionFixture {
  id: string
  title: string
  description: string | null
  objective: string | null
  scene_context: string | null
  character_name: string | null
  expected_outcome_indicator: string | null
  example_conversation: string | null
  cefr_level: CefrLevel
  tier: number | null
  base_duration_seconds: number | null
}

interface IntroFixture {
  mission_id: string
  scene_title: string
  scene_description: string
  characters: IntroductionCharacter[]
  lines: IntroductionLine[]
  useful_expressions: string[]
  backdrop: MissionBackdrop | null
}

interface VocabFixture {
  mission_id: string
  words: Array<{ word: string; translation: string; example: string; example_translation: string }>
}

function readFixture<T>(file: string): T[] {
  if (!fs.existsSync(file)) return []
  const rows = JSON.parse(fs.readFileSync(file, 'utf-8')) as T[]
  if (!Array.isArray(rows)) throw new Error(`El fichero ${file} no contiene una lista`)
  return rows
}

/** Sembrado de fixtures: crea o pisa por `mission_id` (idempotente). */
async function seedIntro(intro: IntroFixture): Promise<'created' | 'updated'> {
  const [existing] = await db
    .select({ id: mission_introductions.id })
    .from(mission_introductions)
    .where(eq(mission_introductions.mission_id, intro.mission_id))
    .limit(1)

  const values = {
    mission_id: intro.mission_id,
    scene_title: intro.scene_title,
    scene_description: intro.scene_description,
    characters: intro.characters,
    lines: intro.lines,
    useful_expressions: intro.useful_expressions,
    backdrop: intro.backdrop,
    generated_by: 'fixture',
    version: 1,
    is_published: true,
    updated_at: new Date(),
  }

  if (existing) {
    await db.update(mission_introductions).set(values).where(eq(mission_introductions.id, existing.id))
    return 'updated'
  }

  await db.insert(mission_introductions).values({ id: randomUUID(), ...values })
  return 'created'
}

async function seedVocabulary(vocab: VocabFixture): Promise<void> {
  await db
    .insert(mission_vocabulary)
    .values({
      id: randomUUID(),
      mission_id: vocab.mission_id,
      words: vocab.words,
      generated_by: 'fixture',
      version: 1,
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: mission_vocabulary.mission_id,
      set: { words: vocab.words, generated_by: 'fixture', updated_at: new Date() },
    })
}

async function main() {
  const rows = readFixture<MissionFixture>(MISSION_FIXTURE)

  if (rows.length === 0) {
    throw new Error(`El fichero ${MISSION_FIXTURE} no contiene misiones`)
  }

  for (const row of rows) {
    await db
      .insert(missions)
      .values(row)
      .onConflictDoUpdate({
        target: missions.id,
        set: {
          title: row.title,
          description: row.description,
          objective: row.objective,
          scene_context: row.scene_context,
          character_name: row.character_name,
          expected_outcome_indicator: row.expected_outcome_indicator,
          example_conversation: row.example_conversation,
          cefr_level: row.cefr_level,
          tier: row.tier,
          base_duration_seconds: row.base_duration_seconds,
        },
      })
  }

  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.cefr_level, (counts.get(row.cefr_level) ?? 0) + 1)

  console.log(`${rows.length} misiones sembradas:`)
  for (const [level, count] of [...counts].sort()) console.log(`  ${level}: ${count}`)

  // Contenido escrito a mano: escena narrativa y palabras clave (y con ellas
  // el emparejamiento). Se siembra directo, sin modelo.
  const intros = readFixture<IntroFixture>(INTRO_FIXTURE)
  for (const intro of intros) await seedIntro(intro)
  if (intros.length > 0) console.log(`${intros.length} escenas sembradas desde fixture`)

  const vocab = readFixture<VocabFixture>(VOCAB_FIXTURE)
  for (const entry of vocab) await seedVocabulary(entry)
  if (vocab.length > 0) console.log(`${vocab.length} vocabularios sembrados desde fixture (con emparejamiento)`)

  // Lo que siga faltando (misiones generadas que aún no tienen contenido) se
  // precalienta con el modelo. Con `--no-prewarm` se omite.
  if (!process.argv.includes('--no-prewarm')) {
    console.log('\nPrecalentando escena y vocabulario de lo que falte…')
    await prewarmMissingContent()
  }
}

main()
  .catch(error => {
    console.error('Error sembrando misiones:', error)
    process.exitCode = 1
  })
  .finally(() => sql.end({ timeout: 5 }))
