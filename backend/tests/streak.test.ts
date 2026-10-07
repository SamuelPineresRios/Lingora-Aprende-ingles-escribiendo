/**
 * Tests de la racha: multiplicador de XP, aviso de riesgo y escudos.
 *
 * Lo importante: que la racha se mida antes del envío, que el multiplicador
 * solo pague misiones completadas y que un escudo reconecte la cadena de días.
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
import { evaluations, responses, streak_shields } from '../src/db/schema.ts'
import { missionXp, streakMultiplier } from '../src/lib/xp.ts'
import { resetDb } from './helpers/db.ts'
import { createMission, signupActor, type Actor } from './helpers/fixtures.ts'

const app = createApp()
const mockedCompleteChat = vi.mocked(completeChat)
const DAY_MS = 24 * 60 * 60 * 1000

/** Día `daysAgo` a las 12:00 UTC (con tz UTC en los tests, es su mediodía). */
function atNoon(daysAgo: number): Date {
  const date = new Date()
  date.setUTCHours(12, 0, 0, 0)
  return new Date(date.getTime() - daysAgo * DAY_MS)
}

/** Respuesta guardada (sin evaluación): solo cuenta para la cadena de días. */
async function seedDay(student: Actor, missionId: string, daysAgo: number, xp = 0): Promise<void> {
  const responseId = randomUUID()
  await db.insert(responses).values({
    id: responseId,
    mission_id: missionId,
    student_id: student.id,
    text_content: 'texto',
    input_mode: 'text',
    transcript: null,
    time_taken_seconds: 120,
    submitted_at: atNoon(daysAgo),
    status: 'completed',
  })
  if (xp > 0) {
    await db.insert(evaluations).values({
      id: randomUUID(),
      response_id: responseId,
      comprehensibility_score: 80,
      grammar_score: 80,
      lexical_richness_score: 80,
      judgment: 'ADVANCE',
      feedback_text: 'texto',
      detected_structures: [],
      transcript: null,
      evaluated_at: atNoon(daysAgo),
      xp_awarded: xp,
    })
  }
}

beforeEach(async () => {
  await resetDb()
  mockedCompleteChat.mockReset()
  mockedCompleteChat.mockResolvedValue(
    JSON.stringify({
      comprehensibility_score: 80,
      grammar_score: 80,
      lexical_richness_score: 80,
      judgment: 'ADVANCE',
      feedback_text: 'ok',
      detected_structures: [],
    }),
  )
})

describe('streakMultiplier', () => {
  it('sube por tramos y se topa', () => {
    expect(streakMultiplier(0)).toBe(1)
    expect(streakMultiplier(2)).toBe(1)
    expect(streakMultiplier(3)).toBe(1.1)
    expect(streakMultiplier(7)).toBe(1.2)
    expect(streakMultiplier(14)).toBe(1.3)
    expect(streakMultiplier(30)).toBe(1.5)
    expect(streakMultiplier(365)).toBe(1.5)
  })
})

describe('racha en el progreso', () => {
  it('marca riesgo si practicó ayer y aún no hoy', async () => {
    const ana = await signupActor(app, 'student')
    const mission = await createMission({ cefr_level: 'B1' })
    for (const daysAgo of [3, 2, 1]) await seedDay(ana, mission, daysAgo)

    const res = await ana.agent.get(`/api/students/${ana.id}/xp?tz=UTC`)

    expect(res.body.progress.streak).toBe(3)
    expect(res.body.progress.streak_at_risk).toBe(true)
    expect(res.body.progress.streak_broken).toBe(false)
    expect(res.body.progress.streak_shields).toBe(0)
  })

  it('marca rota si se dejó pasar el día y hay escudos disponibles', async () => {
    const ana = await signupActor(app, 'student')
    const mission = await createMission({ cefr_level: 'B1' })
    await seedDay(ana, mission, 3)
    await db.insert(streak_shields).values({ id: randomUUID(), student_id: ana.id, used_for_day: null, created_at: new Date() })

    const res = await ana.agent.get(`/api/students/${ana.id}/xp?tz=UTC`)

    expect(res.body.progress.streak).toBe(0)
    expect(res.body.progress.streak_broken).toBe(true)
    expect(res.body.progress.streak_shields).toBe(1)
  })
})

describe('el XP de una misión completada lleva el multiplicador de racha', () => {
  it('con tres días seguidos paga un 10 % más', async () => {
    const ana = await signupActor(app, 'student')
    // Misiones distintas por día: la de hoy debe ser primera vez para pagar
    // el bonus completo, no el 25 % de repetición.
    for (const daysAgo of [3, 2, 1]) {
      const previa = await createMission({ cefr_level: 'B1' })
      await seedDay(ana, previa, daysAgo)
    }
    const mission = await createMission({ cefr_level: 'B1' })

    const res = await ana.agent
      .post(`/api/missions/${mission}/submit`)
      .send({ response_text: 'Hello, I would like to ask for directions to the museum please.', tz: 'UTC' })
    expect(res.status).toBe(200)

    const base = missionXp({
      cefrLevel: 'B1',
      completed: true,
      firstCompletion: true,
      scores: [80, 80, 80],
    })
    expect(base).toBe(120)

    // Solo hay una evaluación: la del envío que acaba de hacerse.
    const rows = await db.select({ xp: evaluations.xp_awarded }).from(evaluations)
    expect(rows[0]?.xp).toBe(Math.round(base * streakMultiplier(3)))
  })
})

describe('uso del escudo de racha', () => {
  it('reconecta la cadena y se gasta una sola vez', async () => {
    const ana = await signupActor(app, 'student')
    const mission = await createMission({ cefr_level: 'B1' })
    await seedDay(ana, mission, 3)
    await seedDay(ana, mission, 2)
    await db.insert(streak_shields).values({ id: randomUUID(), student_id: ana.id, used_for_day: null, created_at: new Date() })

    const uso = await ana.agent.post(`/api/students/${ana.id}/streak/use-shield?tz=UTC`)
    expect(uso.status).toBe(200)
    expect(uso.body.used_for).toBe(new Date(atNoon(1).getTime()).toISOString().slice(0, 10))

    const progreso = await ana.agent.get(`/api/students/${ana.id}/xp?tz=UTC`)
    expect(progreso.body.progress.streak).toBe(3)
    expect(progreso.body.progress.streak_shields).toBe(0)

    const sinEscudos = await ana.agent.post(`/api/students/${ana.id}/streak/use-shield?tz=UTC`)
    expect(sinEscudos.status).toBe(400)
    expect(sinEscudos.body.error).toBe('No tienes escudos')
  })

  it('no gasta el escudo si la racha no lo necesita', async () => {
    const ana = await signupActor(app, 'student')
    const mission = await createMission({ cefr_level: 'B1' })
    await seedDay(ana, mission, 0)
    await db.insert(streak_shields).values({ id: randomUUID(), student_id: ana.id, used_for_day: null, created_at: new Date() })

    const res = await ana.agent.post(`/api/students/${ana.id}/streak/use-shield?tz=UTC`)
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Tu racha no necesita escudo')
  })
})
