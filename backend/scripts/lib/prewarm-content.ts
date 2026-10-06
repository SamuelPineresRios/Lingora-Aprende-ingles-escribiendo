/**
 * Precalentado del contenido generado de las misiones.
 *
 * Cada misión genera su escena narrativa y su vocabulario la primera vez que
 * un alumno la abre: son dos llamadas al modelo y el alumno paga la espera de
 * «Preparando la escena» / «Preparando el vocabulario». Esta función deja todo
 * generado con una concurrencia pequeña y es idempotente: solo pide lo que
 * falta, así que puede repetirse para reintentar fallos de red.
 *
 * Vive aparte del CLI para que `missions:generate` y `missions:seed` la
 * reutilicen (una sola fuente de verdad).
 */
import { asc, eq } from 'drizzle-orm'
import { db } from '../../src/db/client.ts'
import { mission_introductions, mission_vocabulary, missions } from '../../src/db/schema.ts'
import { getOrCreateIntroduction } from '../../src/modules/introductions/service.ts'
import { getOrCreateVocabulary } from '../../src/modules/vocabulary/service.ts'

/** Llamadas al modelo en paralelo: suficiente para avanzar sin saturar la API. */
const DEFAULT_CONCURRENCY = 3

export interface PrewarmResult {
  /** Misiones a las que les faltaba algo. */
  pending: number
  scenes: number
  vocabularies: number
  failed: number
}

export async function prewarmMissingContent(
  options: { dry?: boolean; concurrency?: number } = {},
): Promise<PrewarmResult> {
  const { dry = false, concurrency = DEFAULT_CONCURRENCY } = options

  const rows = await db
    .select({
      id: missions.id,
      title: missions.title,
      introId: mission_introductions.id,
      vocabId: mission_vocabulary.id,
    })
    .from(missions)
    .leftJoin(mission_introductions, eq(mission_introductions.mission_id, missions.id))
    .leftJoin(mission_vocabulary, eq(mission_vocabulary.mission_id, missions.id))
    .orderBy(asc(missions.id))

  const pending = rows.filter(row => !row.introId || !row.vocabId)
  const missingIntros = pending.filter(row => !row.introId).length
  const missingVocab = pending.filter(row => !row.vocabId).length

  console.log(
    `${pending.length} misiones con contenido pendiente (${missingIntros} escenas · ${missingVocab} vocabularios)${dry ? ' (dry)' : ''}`,
  )

  let scenes = 0
  let vocabularies = 0
  let failed = 0
  const queue = [...pending]

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const row = queue.shift()
      if (!row) return
      try {
        if (!row.introId) {
          if (!dry) await getOrCreateIntroduction(row.id)
          scenes += 1
          console.log(`  · escena: ${row.title}`)
        }
        if (!row.vocabId) {
          if (!dry) await getOrCreateVocabulary(row.id)
          vocabularies += 1
          console.log(`  · vocabulario: ${row.title}`)
        }
      } catch (err) {
        failed += 1
        console.warn(`  ✗ ${row.title}: ${(err as Error).message}`)
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  console.log(
    `${dry ? '[dry] ' : ''}${scenes} escenas y ${vocabularies} vocabularios ${dry ? 'se generarían' : 'generados'}${failed ? `, ${failed} fallos (vuelve a ejecutarlo para reintentarlos)` : ''}`,
  )

  return { pending: pending.length, scenes, vocabularies, failed }
}
