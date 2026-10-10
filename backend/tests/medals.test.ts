/**
 * Tests de medallas.
 *
 * Lo importante: que se otorguen al cumplir el hito, que no se regalen solas
 * y que queden guardadas para siempre (aunque después cambie el dato).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { createApp } from '../src/app.ts'
import { db } from '../src/db/client.ts'
import { narrative_states, purchases, saved_words, word_lookups } from '../src/db/schema.ts'
import { MEDALS } from '../src/lib/medals.ts'
import { resetDb } from './helpers/db.ts'
import { createMission, signupActor } from './helpers/fixtures.ts'

const app = createApp()

/** Crea misiones del nivel pedido y devuelve sus ids. */
async function seedMissions(level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1', count: number): Promise<string[]> {
  const ids: string[] = []
  for (let index = 0; index < count; index++) {
    const id = `m-med-${level}-${index}`
    await createMission({ id, cefr_level: level })
    ids.push(id)
  }
  return ids
}

async function completeMissions(studentId: string, missionIds: string[]): Promise<void> {
  if (missionIds.length === 0) return
  await db.insert(narrative_states).values(
    missionIds.map(missionId => ({
      id: randomUUID(),
      student_id: studentId,
      mission_id: missionId,
      state: 'completed',
      updated_at: new Date(),
    })),
  )
}

beforeEach(async () => {
  await resetDb()
})

describe('medallas del alumno', () => {
  it('un alumno nuevo no tiene ninguna y recibe el catálogo completo', async () => {
    const student = await signupActor(app, 'student')

    const res = await student.agent.get(`/api/students/${student.id}/medals`)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(MEDALS.length)
    expect(res.body.earned).toBe(0)
    expect(res.body.medals.every((medal: { earned: boolean }) => !medal.earned)).toBe(true)
  })

  it('otorga «Primer Paso» al completar una misión y la guarda para siempre', async () => {
    const student = await signupActor(app, 'student')
    const misiones = await seedMissions('A1', 1)
    await completeMissions(student.id, misiones)

    const primera = await student.agent.get(`/api/students/${student.id}/medals`)
    const paso = primera.body.medals.find((medal: { id: string }) => medal.id === 'primera-mision')
    expect(paso.earned).toBe(true)
    expect(paso.earned_at).toBeTruthy()

    // Aunque se borre el progreso, la medalla sigue siendo suya.
    await db.delete(narrative_states).where(eq(narrative_states.student_id, student.id))
    const despues = await student.agent.get(`/api/students/${student.id}/medals`)
    expect(despues.body.medals.find((medal: { id: string }) => medal.id === 'primera-mision').earned).toBe(true)
  })

  it('completar todo un nivel da su medalla (y solo la de ese nivel)', async () => {
    const student = await signupActor(app, 'student')
    const a1 = await seedMissions('A1', 2)
    await seedMissions('A2', 1)
    await completeMissions(student.id, a1)

    const res = await student.agent.get(`/api/students/${student.id}/medals`)
    const byId = (id: string) => res.body.medals.find((medal: { id: string }) => medal.id === id)

    expect(byId('dios-a1').earned).toBe(true)
    expect(byId('principe-basico').earned).toBe(false)
    expect(byId('primera-mision').earned).toBe(true)
  })

  it('cuenta vocabulario y compras', async () => {
    const student = await signupActor(app, 'student')

    await db.insert(word_lookups).values(
      Array.from({ length: 50 }, (_, index) => ({
        id: `wl-med-${index}`,
        word: `word-${index}`,
        translation: `palabra-${index}`,
        part_of_speech: 'noun',
        examples: [],
      })),
    )
    await db.insert(saved_words).values(
      Array.from({ length: 50 }, (_, index) => ({
        id: `sw-med-${index}`,
        student_id: student.id,
        word_lookup_id: `wl-med-${index}`,
      })),
    )
    await db.insert(purchases).values(
      Array.from({ length: 5 }, (_, index) => ({
        id: `p-med-${index}`,
        student_id: student.id,
        item_id: `articulo-${index}`,
      })),
    )

    const res = await student.agent.get(`/api/students/${student.id}/medals`)
    const byId = (id: string) => res.body.medals.find((medal: { id: string }) => medal.id === id)

    expect(byId('palabras-50').earned).toBe(true)
    expect(byId('palabras-150').earned).toBe(false)
    expect(byId('comprador-5').earned).toBe(true)
  })
})
