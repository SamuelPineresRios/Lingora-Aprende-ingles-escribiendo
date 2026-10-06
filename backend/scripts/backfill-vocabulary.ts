/**
 * Regenera el vocabulario clave que quedó con el tamaño antiguo.
 *
 *   npm run vocabulary:backfill -w @vox/backend
 *   npm run vocabulary:backfill -w @vox/backend -- --dry
 *
 * La actividad pasó de 7 a 5 palabras: las fichas ya generadas conservan las 7
 * antiguas en `mission_vocabulary.words`. Este script regenera solo esas (una
 * llamada al modelo por misión) reutilizando `regenerateVocabulary`, que ya
 * exige el 5 exacto y sube la versión. Idempotente: si todas tienen 5, no hace
 * nada.
 */
import { sql } from '../src/db/client.ts'
import { REQUIRED_WORDS, regenerateVocabulary } from '../src/modules/vocabulary/service.ts'

const dry = process.argv.includes('--dry')

const rows = await sql<{ mission_id: string; title: string }[]>`
  SELECT v.mission_id, m.title
  FROM mission_vocabulary v
  JOIN missions m ON m.id = v.mission_id
  WHERE jsonb_array_length(v.words) <> ${REQUIRED_WORDS}
  ORDER BY v.mission_id
`

console.log(`${rows.length} misiones con vocabulario de tamaño antiguo${dry ? ' (dry)' : ''}`)

let updated = 0
let failed = 0

for (const row of rows) {
  console.log(`  · ${row.title}`)
  if (dry) {
    updated += 1
    continue
  }

  try {
    await regenerateVocabulary(row.mission_id)
    updated += 1
  } catch (err) {
    failed += 1
    console.warn(`  ✗ ${row.title}: ${(err as Error).message}`)
  }
}

console.log(`\n${dry ? '[dry] ' : ''}${updated} vocabularios ${dry ? 'se regenerarían' : 'regenerados'}${failed ? `, ${failed} fallos` : ''}`)
process.exit(0)
