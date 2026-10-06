/**
 * Rellena el fondo de las introducciones cacheadas antes de que existiera.
 *
 *   npm run backdrops:backfill -w @vox/backend
 *   npm run backdrops:backfill -w @vox/backend -- --dry
 *
 * Pide SOLO la dirección de arte (una llamada corta por escena) y actualiza
 * `mission_introductions.backdrop`. Solo toca filas con `backdrop IS NULL`,
 * así que es idempotente y se puede repetir si el proveedor falla en alguna.
 */
import { asc, eq, isNull } from 'drizzle-orm'
import { db } from '../src/db/client.ts'
import { mission_introductions, missions } from '../src/db/schema.ts'
import { completeChat } from '../src/lib/ai.ts'
import { sanitizeBackdrop } from '../src/modules/introductions/backdrop.ts'
import { BACKDROP_SCHEMA, buildBackdropPrompt } from '../src/modules/introductions/prompts.ts'

const dry = process.argv.includes('--dry')

const rows = await db
  .select({
    id: mission_introductions.id,
    sceneDescription: mission_introductions.scene_description,
    title: missions.title,
    sceneContext: missions.scene_context,
  })
  .from(mission_introductions)
  .innerJoin(missions, eq(missions.id, mission_introductions.mission_id))
  .where(isNull(mission_introductions.backdrop))
  .orderBy(asc(missions.id))

console.log(`${rows.length} escenas sin fondo${dry ? ' (dry)' : ''}`)

let updated = 0
let failed = 0

for (const row of rows) {
  try {
    const content = await completeChat({
      messages: [
        {
          role: 'user',
          content: buildBackdropPrompt({
            title: row.title,
            sceneContext: row.sceneContext,
            sceneDescription: row.sceneDescription,
          }),
        },
      ],
      schema: BACKDROP_SCHEMA,
      maxTokens: 400,
    })

    const backdrop = sanitizeBackdrop(JSON.parse(content))
    if (!backdrop) {
      failed += 1
      console.warn(`  ✗ ${row.id}: el modelo devolvió un fondo no válido`)
      continue
    }

    console.log(`  · ${row.title} → ${backdrop.kind}/${backdrop.style}/${backdrop.light}`)
    if (!dry) {
      await db
        .update(mission_introductions)
        .set({ backdrop, updated_at: new Date() })
        .where(eq(mission_introductions.id, row.id))
    }
    updated += 1
  } catch (err) {
    failed += 1
    console.warn(`  ✗ ${row.title}: ${(err as Error).message}`)
  }
}

console.log(`\n${dry ? '[dry] ' : ''}${updated} fondos ${dry ? 'se escribirían' : 'escritos'}${failed ? `, ${failed} fallos` : ''}`)
process.exit(0)
