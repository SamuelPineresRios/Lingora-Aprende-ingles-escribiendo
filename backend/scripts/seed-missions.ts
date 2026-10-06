/**
 * Siembra las misiones desde `scripts/fixtures/missions.json`.
 *
 *   npm run missions:seed -w @vox/backend
 *
 * Es idempotente: inserta las que faltan y actualiza las existentes por id,
 * así que sirve tanto para levantar el proyecto desde cero como para
 * restaurar el contenido si se pierde la base de datos.
 *
 * El JSON es la copia versionada del contenido (las misiones se generan con
 * `missions:generate`, pero esa generación no es determinista).
 */
import fs from 'node:fs'
import path from 'node:path'
import type { CefrLevel } from '@vox/shared'
import { db, sql } from '../src/db/client.ts'
import { missions } from '../src/db/schema.ts'
import { prewarmMissingContent } from './lib/prewarm-content.ts'

const FIXTURE = path.join(import.meta.dirname, 'fixtures', 'missions.json')

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
  base_duration_seconds: number | null
}

async function main() {
  const rows = JSON.parse(fs.readFileSync(FIXTURE, 'utf-8')) as MissionFixture[]

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`El fichero ${FIXTURE} no contiene misiones`)
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
          base_duration_seconds: row.base_duration_seconds,
        },
      })
  }

  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.cefr_level, (counts.get(row.cefr_level) ?? 0) + 1)

  console.log(`${rows.length} misiones sembradas:`)
  for (const [level, count] of [...counts].sort()) console.log(`  ${level}: ${count}`)

  // El contenido generado (escena y vocabulario) se cachea en la base de
  // datos: precalentarlo aquí evita que el primer alumno espere. Con
  // `--no-prewarm` se omite (p. ej. si el proveedor de IA está caído).
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
