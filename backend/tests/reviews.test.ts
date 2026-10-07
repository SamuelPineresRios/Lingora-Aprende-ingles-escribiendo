/**
 * Tests del repaso espaciado (SRS).
 *
 * Lo importante: la escalera 1-3-7-21, que solo se repase lo que toca, que la
 * corrección sea del servidor y que las opciones salgan del propio alumno.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'

vi.mock('../src/lib/ai.ts', () => {
  class AIProviderError extends Error {
    readonly status: number
    readonly detail: string | undefined
    constructor(message: string, status: number, detail?: string) {
      super(message)
      this.name = 'AIProviderError'
      this.status = status
      this.detail = detail
    }
  }
  return {
    DEFAULT_AI_MODEL: 'test-model',
    AIProviderError,
    requireAnthropicKey: vi.fn(() => 'test-key'),
    completeChat: vi.fn(),
  }
})

import { completeChat } from '../src/lib/ai.ts'
import { createApp } from '../src/app.ts'
import { db } from '../src/db/client.ts'
import { saved_words, word_lookups } from '../src/db/schema.ts'
import { nextSchedule } from '../src/lib/srs.ts'
import { resetDb } from './helpers/db.ts'
import { signupActor, type Actor } from './helpers/fixtures.ts'

const app = createApp()
const mockedCompleteChat = vi.mocked(completeChat)

const HELP_CARD = JSON.stringify({
  translation: 'ayudar',
  part_of_speech: 'verb',
  present: 'help',
  past: 'helped',
  past_participle: 'helped',
  examples: [
    { en: 'Can you help me?', es: '¿Puedes ayudarme?' },
    { en: 'She helped her mother.', es: 'Ella ayudó a su madre.' },
  ],
})

const DAY_MS = 24 * 60 * 60 * 1000

/** Palabra guardada con su ficha; `dueInDays` negativo = ya toca repasarla. */
async function seedSavedWord(
  student: Actor,
  word: string,
  translation: string,
  { dueInDays = -1, stage = 0, lapses = 0 }: { dueInDays?: number; stage?: number; lapses?: number } = {},
): Promise<string> {
  const lookupId = randomUUID()
  await db.insert(word_lookups).values({
    id: lookupId,
    word,
    translation,
    part_of_speech: 'noun',
    examples: [{ en: `This is a ${word} example.`, es: `Este es un ejemplo de ${word}.` }],
  })

  const savedId = randomUUID()
  await db.insert(saved_words).values({
    id: savedId,
    student_id: student.id,
    word_lookup_id: lookupId,
    context: null,
    review_stage: stage,
    review_lapses: lapses,
    review_due_at: new Date(Date.now() + dueInDays * DAY_MS),
  })

  return savedId
}

beforeEach(async () => {
  await resetDb()
  mockedCompleteChat.mockReset()
  mockedCompleteChat.mockResolvedValue(HELP_CARD)
})

describe('escalera del repaso', () => {
  it('sube 1, 3, 7 y 21 días y termina dominada', () => {
    expect(nextSchedule(0, true)).toEqual({ stage: 1, nextInDays: 3, mastered: false })
    expect(nextSchedule(1, true)).toEqual({ stage: 2, nextInDays: 7, mastered: false })
    expect(nextSchedule(2, true)).toEqual({ stage: 3, nextInDays: 21, mastered: false })
    expect(nextSchedule(3, true)).toEqual({ stage: 4, nextInDays: null, mastered: true })
  })

  it('fallar vuelve al principio', () => {
    expect(nextSchedule(0, false)).toEqual({ stage: 0, nextInDays: 1, mastered: false })
    expect(nextSchedule(3, false)).toEqual({ stage: 0, nextInDays: 1, mastered: false })
  })
})

describe('GET /api/students/:id/reviews', () => {
  it('solo devuelve lo que toca, con la frase en blanco y opciones propias', async () => {
    const ana = await signupActor(app, 'student')
    await seedSavedWord(ana, 'museum', 'museo', { dueInDays: -2 })
    await seedSavedWord(ana, 'walking', 'caminando', { dueInDays: -1 })
    await seedSavedWord(ana, 'directions', 'indicaciones', { dueInDays: -1 })
    await seedSavedWord(ana, 'tomorrow', 'mañana', { dueInDays: 1 }) // no toca hoy

    const res = await ana.agent.get(`/api/students/${ana.id}/reviews?limit=5`)

    expect(res.status).toBe(200)
    expect(res.body.due).toBe(3)
    expect(res.body.items).toHaveLength(3)

    const primero = res.body.items[0]
    expect(primero.prompt).toContain('____')
    expect(primero.options).toHaveLength(4)
    const todas = res.body.items.flatMap((item: { options: string[] }) => item.options)
    expect(new Set(todas).size).toBeGreaterThanOrEqual(4)
    for (const item of res.body.items) {
      // La opción correcta va entre las opciones y el prompt no la revela.
      expect(item.prompt.toLowerCase()).not.toContain('____'.toLowerCase() + item.answer)
    }
  })

  it('no manda la respuesta correcta (solo frases y opciones)', async () => {
    const ana = await signupActor(app, 'student')
    await seedSavedWord(ana, 'museum', 'museo')

    const res = await ana.agent.get(`/api/students/${ana.id}/reviews`)

    expect(res.body.items[0].answer).toBeUndefined()
    expect(res.body.items[0].translation).toBeUndefined()
  })
})

describe('POST /api/students/:id/reviews/:savedId/answer', () => {
  it('acertar sube el escalón y deja la palabra para dentro de tres días', async () => {
    const ana = await signupActor(app, 'student')
    const savedId = await seedSavedWord(ana, 'museum', 'museo')

    const res = await ana.agent
      .post(`/api/students/${ana.id}/reviews/${savedId}/answer`)
      .send({ option: 'Museum' })

    expect(res.status).toBe(200)
    expect(res.body.correct).toBe(true)
    expect(res.body.answer).toBe('museum')
    expect(res.body.schedule).toEqual({ stage: 1, nextInDays: 3, mastered: false })
    expect(res.body.due).toBe(0)

    const [row] = await db.select().from(saved_words)
    expect(row?.review_stage).toBe(1)
    expect(row?.review_lapses).toBe(0)
    expect(row?.reviewed_at).not.toBeNull()
    const days = ((row?.review_due_at?.getTime() ?? 0) - Date.now()) / DAY_MS
    expect(days).toBeGreaterThan(2.9)
    expect(days).toBeLessThan(3.1)
  })

  it('fallar vuelve a cero, cuenta la falta y vuelve mañana', async () => {
    const ana = await signupActor(app, 'student')
    const savedId = await seedSavedWord(ana, 'museum', 'museo', { stage: 2, lapses: 1 })

    const res = await ana.agent
      .post(`/api/students/${ana.id}/reviews/${savedId}/answer`)
      .send({ option: 'walking' })

    expect(res.body.correct).toBe(false)
    expect(res.body.schedule).toEqual({ stage: 0, nextInDays: 1, mastered: false })

    const [row] = await db.select().from(saved_words)
    expect(row?.review_stage).toBe(0)
    expect(row?.review_lapses).toBe(2)
  })

  it('al superar la escalera la palabra queda dominada y no vuelve', async () => {
    const ana = await signupActor(app, 'student')
    const savedId = await seedSavedWord(ana, 'museum', 'museo', { stage: 3 })

    const res = await ana.agent
      .post(`/api/students/${ana.id}/reviews/${savedId}/answer`)
      .send({ option: 'museum' })

    expect(res.body.schedule.mastered).toBe(true)
    const [row] = await db.select().from(saved_words)
    expect(row?.review_due_at).toBeNull()

    const pendientes = await ana.agent.get(`/api/students/${ana.id}/reviews`)
    expect(pendientes.body.due).toBe(0)
  })

  it('guardar una palabra la deja para mañana y respeta permisos', async () => {
    const ana = await signupActor(app, 'student')
    const luis = await signupActor(app, 'student')
    const teacher = await signupActor(app, 'teacher')

    const guardada = await ana.agent.post('/api/words').send({ word: 'help', context: 'Can you help me?' })
    expect(guardada.status).toBe(201)

    const alDia = await ana.agent.get(`/api/students/${ana.id}/reviews`)
    expect(alDia.body.due).toBe(0)

    const [row] = await db.select().from(saved_words)
    const horas = ((row?.review_due_at?.getTime() ?? 0) - Date.now()) / (60 * 60 * 1000)
    expect(horas).toBeGreaterThan(23)

    // Permisos: mirar sí (docente), responder no; otro alumno, nada.
    const savedId = row!.id
    expect((await teacher.agent.get(`/api/students/${ana.id}/reviews`)).status).toBe(200)
    expect(
      (await teacher.agent.post(`/api/students/${ana.id}/reviews/${savedId}/answer`).send({ option: 'help' })).status,
    ).toBe(403)
    expect((await luis.agent.get(`/api/students/${ana.id}/reviews`)).status).toBe(403)
    expect(
      (await luis.agent.post(`/api/students/${ana.id}/reviews/${savedId}/answer`).send({ option: 'help' })).status,
    ).toBe(403)
  })
})
