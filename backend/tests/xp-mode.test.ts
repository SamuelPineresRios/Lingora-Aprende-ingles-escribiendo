/**
 * Tests del XP por modo.
 *
 * La práctica libre no paga XP; el Desafío sí, y una pasada libre previa no
 * gasta el bonus de la primera misión puntuada.
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

const GOOD_EVALUATION = {
  comprehensibility_score: 90,
  grammar_score: 85,
  lexical_richness_score: 80,
  judgment: 'ADVANCE',
  feedback_text: 'Te entendieron.\n\nBuen trabajo.\n\n- Sigue así.',
  detected_structures: ['present-simple'],
  improvements: [{ original: '', correction: 'Keep going!', explanation: 'Sigue practicando.' }],
}

/** Envía una respuesta y devuelve el id de la evaluación. */
async function submit(student: Awaited<ReturnType<typeof signupActor>>, missionId: string, mode?: 'free' | 'evaluation') {
  const res = await student.agent.post(`/api/missions/${missionId}/submit`).send({
    response_text: 'Excuse me, where is the museum? I am walking.',
    time_taken_seconds: 60,
    ...(mode ? { mode } : {}),
  })
  expect(res.status).toBe(200)
  return res.body.evaluation_id as string
}

async function xpOf(student: Awaited<ReturnType<typeof signupActor>>, evaluationId: string): Promise<number> {
  const res = await student.agent.get(`/api/evaluations/${evaluationId}`)
  expect(res.status).toBe(200)
  return res.body.evaluation.xp_awarded
}

beforeEach(async () => {
  await resetDb()
  mockedCompleteChat.mockReset()
  mockedCompleteChat.mockResolvedValue(JSON.stringify(GOOD_EVALUATION))
})

describe('XP según el modo', () => {
  it('la práctica libre se guarda pero no paga XP', async () => {
    const ana = await signupActor(app, 'student', { cefr_level: 'A1' })
    const missionId = await createMission({ id: 'm-xp-1', cefr_level: 'A1' })

    const evaluationId = await submit(ana, missionId, 'free')

    expect(await xpOf(ana, evaluationId)).toBe(0)
  })

  it('el Desafío paga; la pasada libre previa no gasta el bonus', async () => {
    const ana = await signupActor(app, 'student', { cefr_level: 'A1' })
    const missionId = await createMission({ id: 'm-xp-2', cefr_level: 'A1' })

    await submit(ana, missionId, 'free')
    const firstChallenge = await xpOf(ana, await submit(ana, missionId, 'evaluation'))
    const secondChallenge = await xpOf(ana, await submit(ana, missionId, 'evaluation'))

    expect(firstChallenge).toBeGreaterThan(0)
    expect(secondChallenge).toBeGreaterThan(0)
    // La repetición da práctica (ratio menor), no el bonus completo.
    expect(secondChallenge).toBeLessThan(firstChallenge)
  })
})
