/**
 * Tests de puntos débiles: banco de drills, registro de errores desde el chat
 * y el informe con la sesión de práctica.
 *
 * Lo importante: que el banco esté completo y bien formado, que solo se
 * registren tipos conocidos, que el informe ordene por frecuencia y arme la
 * sesión con el tipo más fallado, y que el chat guarde el error del turno.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'

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
import { grammar_errors } from '../src/db/schema.ts'
import { ERROR_TYPES, buildDrillSession } from '../src/lib/drills.ts'
import { getWeaknessReport, recordGrammarError } from '../src/modules/drills/service.ts'
import { resetDb } from './helpers/db.ts'
import { createMission, signupActor } from './helpers/fixtures.ts'

const app = createApp()
const mockedCompleteChat = vi.mocked(completeChat)

beforeEach(async () => {
  await resetDb()
  mockedCompleteChat.mockReset()
})

describe('banco de drills', () => {
  it('cada tipo tiene al menos tres ejercicios bien formados', () => {
    for (const type of ERROR_TYPES) {
      // El tipo repetido garantiza que la sesión saque sus propios ejercicios.
      const session = buildDrillSession([type.id, type.id], 10)
      const propios = session.filter(exercise => exercise.type === type.id)
      expect(propios.length).toBeGreaterThanOrEqual(3)

      for (const exercise of propios) {
        expect(exercise.options).toHaveLength(3)
        expect(exercise.options).toContain(exercise.answer)
        expect(exercise.translation.length).toBeGreaterThan(0)
      }
    }
  })

  it('arma la sesión con el tipo más fallado delante', () => {
    const session = buildDrillSession(['article', 'plural'])
    expect(session).toHaveLength(3)
    expect(session[0]?.type).toBe('article')
    expect(session[1]?.type).toBe('article')
    expect(session[2]?.type).toBe('plural')

    const mixta = buildDrillSession([])
    expect(mixta).toHaveLength(3)
  })
})

describe('registro de errores', () => {
  it('guarda los tipos conocidos e ignora los desconocidos', async () => {
    const ana = await signupActor(app, 'student')
    const missionId = await createMission({ cefr_level: 'B1' })

    await recordGrammarError(ana.id, missionId, 'article')
    await recordGrammarError(ana.id, missionId, 'inventado')

    const rows = await db.select().from(grammar_errors).where(eq(grammar_errors.student_id, ana.id))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.error_type).toBe('article')
  })

  it('el informe ordena por frecuencia y arma la sesión con el top', async () => {
    const ana = await signupActor(app, 'student')
    for (let index = 0; index < 3; index++) await recordGrammarError(ana.id, null, 'third_person_s')
    await recordGrammarError(ana.id, null, 'article')

    const report = await getWeaknessReport(ana.id)

    expect(report.total_errors).toBe(4)
    expect(report.top[0]).toMatchObject({ type: 'third_person_s', count: 3 })
    expect(report.session[0]?.type).toBe('third_person_s')
    expect(report.session[1]?.type).toBe('third_person_s')
  })

  it('sin errores, la sesión sigue existiendo (mixta)', async () => {
    const ana = await signupActor(app, 'student')

    const report = await getWeaknessReport(ana.id)

    expect(report.total_errors).toBe(0)
    expect(report.top).toEqual([])
    expect(report.session).toHaveLength(3)
  })
})

describe('endpoint y chat', () => {
  it('el informe se sirve por API y respeta permisos', async () => {
    const ana = await signupActor(app, 'student')
    const luis = await signupActor(app, 'student')
    const teacher = await signupActor(app, 'teacher')
    await recordGrammarError(ana.id, null, 'preposition')

    const res = await ana.agent.get(`/api/students/${ana.id}/weaknesses`)
    expect(res.status).toBe(200)
    expect(res.body.top[0]).toMatchObject({ type: 'preposition', count: 1 })

    expect((await luis.agent.get(`/api/students/${ana.id}/weaknesses`)).status).toBe(403)
    expect((await teacher.agent.get(`/api/students/${ana.id}/weaknesses`)).status).toBe(200)
  })

  it('el chat registra el tipo de error del turno', async () => {
    mockedCompleteChat.mockResolvedValue(
      JSON.stringify({
        message: "Hmm? I don't follow.",
        message_translation: '¿Mmm? No te sigo.',
        rating: 2,
        feedback: 'Falta el artículo: "an umbrella".',
        correctedText: 'I need an umbrella.',
        missing_step: 'el artículo an',
        confused: true,
        error_type: 'article',
        progress: 0,
        mission_completed: false,
      }),
    )

    const ana = await signupActor(app, 'student', { cefr_level: 'B1' })
    const missionId = await createMission({ id: 'm-drills-1', cefr_level: 'B1' })

    const res = await ana.agent.post('/api/chat').send({
      mode: 'chat',
      messages: [{ role: 'user', content: 'I need umbrella' }],
      mission: { id: missionId, character_name: 'Alex', objective: 'Comprar un paraguas', scene_context: 'Tienda' },
      userLevel: 'B1',
    })

    expect(res.status).toBe(200)
    expect(res.body.error_type).toBe('article')

    const rows = await db.select().from(grammar_errors).where(eq(grammar_errors.student_id, ana.id))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ error_type: 'article', mission_id: missionId })
  })

  it('un turno sin error no registra nada', async () => {
    mockedCompleteChat.mockResolvedValue(
      JSON.stringify({
        message: 'Great!',
        message_translation: '¡Genial!',
        rating: 5,
        feedback: '¡Muy bien!',
        correctedText: null,
        missing_step: null,
        confused: false,
        error_type: null,
        progress: 50,
        mission_completed: false,
      }),
    )

    const ana = await signupActor(app, 'student', { cefr_level: 'B1' })
    await createMission({ id: 'm-drills-2', cefr_level: 'B1' })

    const res = await ana.agent.post('/api/chat').send({
      mode: 'chat',
      messages: [{ role: 'user', content: 'I need an umbrella' }],
      mission: { id: 'm-drills-2', character_name: 'Alex', objective: 'Comprar un paraguas', scene_context: 'Tienda' },
      userLevel: 'B1',
    })

    expect(res.status).toBe(200)
    const rows = await db.select().from(grammar_errors).where(eq(grammar_errors.student_id, ana.id))
    expect(rows).toHaveLength(0)
  })
})
