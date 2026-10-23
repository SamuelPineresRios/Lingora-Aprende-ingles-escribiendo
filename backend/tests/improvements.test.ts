/**
 * Tests del historial de errores (mejoras estructuradas).
 *
 * Lo importante: que el envío guarde las mejoras del informe, que las inválidas
 * se descarten, que el historial las devuelva con su misión y que solo las vea
 * el alumno o sus docentes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
import { resetDb } from './helpers/db.ts'
import { createMission, signupActor } from './helpers/fixtures.ts'

const app = createApp()
const mockedCompleteChat = vi.mocked(completeChat)

const EVALUATION = {
  comprehensibility_score: 80,
  grammar_score: 65,
  lexical_richness_score: 70,
  judgment: 'ADVANCE',
  feedback_text: 'Te entendieron.\n\nBuen intento.\n\n- "How much is they?" → "How much are they?"',
  detected_structures: ['present-simple'],
  improvements: [
    { original: 'How much is they?', correction: 'How much are they?', explanation: 'Con "they" el verbo va en plural: are.' },
    { original: '', correction: 'Could you offer me a discount?', explanation: 'Suena más natural y educado que "give me a discount".' },
    { original: 'basura', correction: '', explanation: '' },
  ],
}

beforeEach(async () => {
  await resetDb()
  mockedCompleteChat.mockReset()
})

describe('historial de errores', () => {
  it('guarda las mejoras del informe y las sirve con su misión', async () => {
    mockedCompleteChat.mockResolvedValue(JSON.stringify(EVALUATION))
    const ana = await signupActor(app, 'student', { cefr_level: 'A1' })
    const missionId = await createMission({ id: 'm-imp-1', title: 'Comprar ropa', cefr_level: 'A1' })

    const submit = await ana.agent
      .post(`/api/missions/${missionId}/submit`)
      .send({ response_text: 'How much is they? I want a discount', time_taken_seconds: 90 })

    expect(submit.status).toBe(200)
    // La mejora inválida (sin corrección ni explicación) se descarta.
    expect(submit.body.evaluation.improvements).toHaveLength(2)

    const history = await ana.agent.get(`/api/students/${ana.id}/improvements`)

    expect(history.status).toBe(200)
    expect(history.body.items).toHaveLength(1)
    expect(history.body.items[0]).toMatchObject({
      mission_id: missionId,
      mission_title: 'Comprar ropa',
      level: 'A1',
    })
    expect(history.body.items[0].improvements[0]).toEqual({
      original: 'How much is they?',
      correction: 'How much are they?',
      explanation: 'Con "they" el verbo va en plural: are.',
    })
  })

  it('sin correcciones el historial está vacío', async () => {
    const ana = await signupActor(app, 'student')

    const history = await ana.agent.get(`/api/students/${ana.id}/improvements`)

    expect(history.status).toBe(200)
    expect(history.body.items).toEqual([])
  })

  it('respeta permisos: solo el alumno o sus docentes', async () => {
    const ana = await signupActor(app, 'student')
    const luis = await signupActor(app, 'student')
    const teacher = await signupActor(app, 'teacher')

    expect((await luis.agent.get(`/api/students/${ana.id}/improvements`)).status).toBe(403)
    expect((await teacher.agent.get(`/api/students/${ana.id}/improvements`)).status).toBe(200)
  })
})
