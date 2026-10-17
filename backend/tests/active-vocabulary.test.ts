/**
 * Tests del vocabulario activo.
 *
 * Lo importante: que cuente solo palabras del vocabulario de misiones
 * completadas que aparecen de verdad en el texto del alumno (sin distinguir
 * mayúsculas ni puntuación), que las demás queden en «por activar» y que el
 * endpoint respete permisos.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createApp } from '../src/app.ts'
import { db } from '../src/db/client.ts'
import { mission_vocabulary, responses } from '../src/db/schema.ts'
import { resetDb } from './helpers/db.ts'
import { createMission, signupActor, type Actor } from './helpers/fixtures.ts'

const app = createApp()

/** Vocabulario de una misión (la tabla exige la lista completa). */
async function seedVocabulary(missionId: string, words: Array<{ word: string; translation: string }>): Promise<void> {
  await db.insert(mission_vocabulary).values({
    id: randomUUID(),
    mission_id: missionId,
    words: words.map(entry => ({
      word: entry.word,
      translation: entry.translation,
      example: `Example with ${entry.word}.`,
      example_translation: `Ejemplo con ${entry.word}.`,
    })),
    generated_by: 'test',
    version: 1,
  })
}

/** Respuesta completada con el texto producido por el alumno. */
async function seedResponse(student: Actor, missionId: string, text: string): Promise<void> {
  await db.insert(responses).values({
    id: randomUUID(),
    mission_id: missionId,
    student_id: student.id,
    text_content: text,
    status: 'completed',
    time_taken_seconds: 60,
    submitted_at: new Date(),
  })
}

beforeEach(async () => {
  await resetDb()
})

describe('GET /api/students/:id/active-vocabulary', () => {
  it('cuenta las palabras usadas y deja el resto por activar', async () => {
    const ana = await signupActor(app, 'student')
    const missionId = await createMission({ id: 'm-av-1', title: 'Pedir un café', cefr_level: 'A1' })
    await seedVocabulary(missionId, [
      { word: 'coffee', translation: 'café' },
      { word: 'please', translation: 'por favor' },
      { word: 'receipt', translation: 'recibo' },
    ])
    await seedResponse(ana, missionId, 'I want a coffee, please. COFFEE!')

    const res = await ana.agent.get(`/api/students/${ana.id}/active-vocabulary`)

    expect(res.status).toBe(200)
    expect(res.body.active_count).toBe(2)
    expect(res.body.studied_total).toBe(3)
    const activas = res.body.active.map((entry: { word: string }) => entry.word).sort()
    expect(activas).toEqual(['coffee', 'please'])
    expect(res.body.pending.map((entry: { word: string }) => entry.word)).toEqual(['receipt'])
    expect(res.body.active[0].mission_title).toBe('Pedir un café')
  })

  it('no cuenta palabras de misiones que no completó ni textos sin la palabra', async () => {
    const ana = await signupActor(app, 'student')
    const completada = await createMission({ id: 'm-av-2', cefr_level: 'A1' })
    const otra = await createMission({ id: 'm-av-3', cefr_level: 'A1' })
    await seedVocabulary(completada, [{ word: 'apple', translation: 'manzana' }])
    await seedVocabulary(otra, [{ word: 'receipt', translation: 'recibo' }])
    // El texto menciona 'receipt', pero esa palabra pertenece a una misión no completada.
    await seedResponse(ana, completada, 'I paid with a receipt but I ate an apple')

    const res = await ana.agent.get(`/api/students/${ana.id}/active-vocabulary`)

    expect(res.body.active_count).toBe(1)
    expect(res.body.active[0].word).toBe('apple')
    expect(res.body.studied_total).toBe(1)
  })

  it('une varias respuestas de la misma misión y reconoce frases de varias palabras', async () => {
    const ana = await signupActor(app, 'student')
    const missionId = await createMission({ id: 'm-av-4', cefr_level: 'B1' })
    await seedVocabulary(missionId, [
      { word: 'customer service', translation: 'atención al cliente' },
      { word: 'refund', translation: 'reembolso' },
    ])
    await seedResponse(ana, missionId, 'I called customer service yesterday.')
    await seedResponse(ana, missionId, 'I want a refund, please.')

    const res = await ana.agent.get(`/api/students/${ana.id}/active-vocabulary`)

    expect(res.body.active_count).toBe(2)
    expect(res.body.pending).toEqual([])
  })

  it('sin misiones completadas todo queda a cero', async () => {
    const ana = await signupActor(app, 'student')

    const res = await ana.agent.get(`/api/students/${ana.id}/active-vocabulary`)

    expect(res.body).toMatchObject({ active_count: 0, studied_total: 0, active: [], pending: [] })
  })

  it('respeta permisos: solo el alumno o sus docentes', async () => {
    const ana = await signupActor(app, 'student')
    const luis = await signupActor(app, 'student')
    const teacher = await signupActor(app, 'teacher')

    expect((await luis.agent.get(`/api/students/${ana.id}/active-vocabulary`)).status).toBe(403)
    expect((await teacher.agent.get(`/api/students/${ana.id}/active-vocabulary`)).status).toBe(200)
  })
})
