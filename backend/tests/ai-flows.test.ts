/**
 * Tests de los flujos que hablan con el proveedor de IA.
 *
 * El módulo de IA se mockea para que estos tests sean deterministas y no
 * dependan de red ni de la clave de Anthropic.
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

import { AIProviderError, completeChat } from '../src/lib/ai.ts'
import { createApp } from '../src/app.ts'
import { sql } from '../src/db/client.ts'
import { resetDb } from './helpers/db.ts'
import { createMission, signupActor } from './helpers/fixtures.ts'

const app = createApp()
const mockedCompleteChat = vi.mocked(completeChat)

beforeEach(async () => {
  await resetDb()
  mockedCompleteChat.mockReset()
})

describe('submit con evaluación ADVANCE', () => {
  it('marca la misión como completada y actualiza el agregado', async () => {
    mockedCompleteChat.mockResolvedValue(
      JSON.stringify({
        comprehensibility_score: 90,
        grammar_score: 85,
        lexical_richness_score: 80,
        judgment: 'ADVANCE',
        feedback_text: '¡Muy bien!',
        detected_structures: ['present-simple'],
      }),
    )

    const student = await signupActor(app, 'student', { cefr_level: 'B1' })
    const missionId = await createMission({ cefr_level: 'B1' })

    const res = await student.agent
      .post(`/api/missions/${missionId}/submit`)
      .send({ response_text: 'My name is Ana and I am from Peru.', time_taken_seconds: 40 })

    expect(res.status).toBe(200)
    expect(res.body.judgment).toBe('ADVANCE')

    const [response] = await sql<{ status: string | null }[]>`
      SELECT status FROM responses WHERE id = ${res.body.response_id}
    `
    expect(response?.status).toBe('completed')

    const [aggregate] = await sql<{ missions_completed: number; total_writing_time_seconds: number }[]>`
      SELECT missions_completed, total_writing_time_seconds FROM weekly_aggregates
    `
    expect(aggregate?.missions_completed).toBe(1)
    expect(aggregate?.total_writing_time_seconds).toBe(40)

    const missions = await student.agent.get('/api/missions')
    expect(missions.body.missions[0].status).toBe('completed')
  })

  it('degrada a la evaluación de respaldo si el modelo devuelve JSON inválido', async () => {
    mockedCompleteChat.mockResolvedValue('esto no es JSON')

    const student = await signupActor(app, 'student', { cefr_level: 'B1' })
    const missionId = await createMission({ cefr_level: 'B1' })

    const res = await student.agent
      .post(`/api/missions/${missionId}/submit`)
      .send({ response_text: 'My name is Ana and I am from Peru.' })

    expect(res.status).toBe(200)
    expect(res.body.evaluation.comprehensibility_score).toBe(65)
    expect(res.body.judgment).toBe('PAUSE')
  })
})

describe('POST /api/chat', () => {
  const mission = {
    character_name: 'Alex',
    objective: 'Introduce yourself',
    scene_context: 'A job interview',
  }

  it('devuelve el turno del personaje con su feedback', async () => {
    mockedCompleteChat.mockResolvedValue(
      JSON.stringify({
        message: 'Hi! What is your name?',
        rating: 4,
        feedback: '¡Buen comienzo!',
        correctedText: null,
        progress: 25,
        mission_completed: false,
      }),
    )

    const student = await signupActor(app, 'student', { cefr_level: 'B1' })

    const res = await student.agent
      .post('/api/chat')
      .send({ mode: 'chat', messages: [], mission, userLevel: 'B1' })

    expect(res.status).toBe(200)
    expect(res.body.message.content).toBe('Hi! What is your name?')
    expect(res.body.feedback).toBe('¡Buen comienzo!')
    expect(res.body.progress).toBe(25)
    expect(res.body.mission_completed).toBe(false)
  })

  it('en modo hints devuelve exactamente dos pistas', async () => {
    mockedCompleteChat.mockResolvedValue(
      JSON.stringify({
        hints: [
          { en: "I'm from Colombia.", es: 'Soy de Colombia.' },
          { en: 'I live in Madrid now.', es: 'Ahora vivo en Madrid.' },
        ],
      }),
    )

    const student = await signupActor(app, 'student')

    const res = await student.agent.post('/api/chat').send({
      mode: 'hints',
      mission,
      userLevel: 'B1',
      lastMessage: 'Where are you from?',
    })

    expect(res.status).toBe(200)
    expect(res.body.hints).toHaveLength(2)
    expect(res.body.hints[0]).toEqual({ en: "I'm from Colombia.", es: 'Soy de Colombia.' })
  })

  it('si el proveedor no da dos pistas válidas responde 502', async () => {
    mockedCompleteChat.mockResolvedValue(JSON.stringify({ hints: [{ en: 'Only one', es: 'Solo una' }] }))

    const student = await signupActor(app, 'student')
    const res = await student.agent.post('/api/chat').send({
      mode: 'hints',
      mission,
      userLevel: 'B1',
      lastMessage: 'Where are you from?',
    })

    expect(res.status).toBe(502)
  })

  it('traduce el fallo del proveedor a 502 (no propaga su 401/429)', async () => {
    mockedCompleteChat.mockRejectedValue(
      new AIProviderError('AI Provider Error: 429 - rate limited', 429, 'rate limited'),
    )

    const student = await signupActor(app, 'student')

    const res = await student.agent
      .post('/api/chat')
      .send({ mode: 'chat', messages: [], mission, userLevel: 'B1' })

    expect(res.status).toBe(502)
    expect(res.body).toEqual({ error: 'Error del proveedor de IA' })
  })
})
