/**
 * Tests del modo invitado.
 *
 * Lo importante: entrar sin cuenta, poder probar misiones sin generar XP,
 * que el tercer envío se corte, que la conversión conserve el mismo alumno y
 * que ranking/social queden cerrados a los invitados (también para los demás).
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
import request from 'supertest'
import { createApp } from '../src/app.ts'
import { resetDb } from './helpers/db.ts'
import { createMission, signupActor } from './helpers/fixtures.ts'

const app = createApp()
const mockedCompleteChat = vi.mocked(completeChat)

const GOOD_EVALUATION = {
  comprehensibility_score: 90,
  grammar_score: 90,
  lexical_richness_score: 85,
  judgment: 'ADVANCE',
  feedback_text: 'Te entendieron.\n\nBuen trabajo.\n\n- Sigue practicando.',
  detected_structures: ['present-simple'],
  improvements: [{ original: '', correction: 'Keep going!', explanation: 'Sigue practicando.' }],
}

const SIGNUP = {
  email: 'convertido@lingora.test',
  password: 'contrasena-segura',
  full_name: 'Alumno Convertido',
  role: 'student',
  cefr_level: 'A1',
}

async function startGuest() {
  const agent = request.agent(app)
  const res = await agent.post('/api/auth/guest')
  expect(res.status).toBe(201)
  return { agent, user: res.body.user as { id: string; is_guest: boolean } }
}

async function submit(agent: ReturnType<typeof request.agent>, missionId: string) {
  return agent.post(`/api/missions/${missionId}/submit`).send({
    response_text: 'Excuse me, where is the museum? I am walking.',
    time_taken_seconds: 60,
    mode: 'evaluation',
  })
}

beforeEach(async () => {
  await resetDb()
  mockedCompleteChat.mockReset()
  mockedCompleteChat.mockResolvedValue(JSON.stringify(GOOD_EVALUATION))
})

describe('modo invitado', () => {
  it('entra sin cuenta y puede ver misiones, pero no ranking ni social', async () => {
    const { agent, user } = await startGuest()
    expect(user.is_guest).toBe(true)

    const me = await agent.get('/api/auth/me')
    expect(me.status).toBe(200)
    expect(me.body.user).toMatchObject({ id: user.id, is_guest: true })

    expect((await agent.get('/api/missions')).status).toBe(200)

    const ranking = await agent.get('/api/students/ranking')
    expect(ranking.status).toBe(403)
    expect(ranking.body.code).toBe('account_required')
    expect((await agent.get('/api/social/me')).status).toBe(403)
  })

  it('prueba 2 misiones sin XP, corta la tercera y conserva todo al registrarse', async () => {
    const { agent, user } = await startGuest()
    const m1 = await createMission({ id: 'm-guest-1', cefr_level: 'A1' })
    const m2 = await createMission({ id: 'm-guest-2', cefr_level: 'A1' })
    const m3 = await createMission({ id: 'm-guest-3', cefr_level: 'A1' })

    const first = await submit(agent, m1)
    const second = await submit(agent, m2)
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)

    // La prueba no paga XP aunque sea Desafío.
    const firstXp = await agent.get(`/api/evaluations/${first.body.evaluation_id}`)
    expect(firstXp.body.evaluation.xp_awarded).toBe(0)

    const third = await submit(agent, m3)
    expect(third.status).toBe(403)
    expect(third.body.code).toBe('guest_limit')

    // Registro: convierte la MISMA cuenta y conserva id/progreso.
    const signup = await agent.post('/api/auth/signup').send(SIGNUP)
    expect(signup.status).toBe(201)
    expect(signup.body.converted_guest).toBe(true)
    expect(signup.body.user).toMatchObject({ id: user.id, is_guest: false, email: SIGNUP.email })

    // Ya no es invitado: la tercera misión se puede enviar y paga XP.
    const afterRegister = await submit(agent, m3)
    expect(afterRegister.status).toBe(200)
    const xp = await agent.get(`/api/evaluations/${afterRegister.body.evaluation_id}`)
    expect(xp.body.evaluation.xp_awarded).toBeGreaterThan(0)

    // El historial de la prueba se conserva bajo la cuenta convertida.
    const history = await agent.get(`/api/students/${user.id}/improvements`)
    expect(history.status).toBe(200)
    expect(history.body.items.length).toBeGreaterThan(0)
  })

  it('un invitado no puede convertirse en profesor', async () => {
    const { agent } = await startGuest()
    const res = await agent
      .post('/api/auth/signup')
      .send({ ...SIGNUP, role: 'teacher', email: 'profe-invitado@lingora.test' })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('estudiante')
  })

  it('el ranking de los alumnos reales no muestra invitados', async () => {
    const real = await signupActor(app, 'student')
    const { user: guest } = await startGuest()

    const ranking = await real.agent.get('/api/students/ranking')
    expect(ranking.status).toBe(200)
    const ids = ranking.body.entries.map((entry: { student_id: string }) => entry.student_id)
    expect(ids).toContain(real.id)
    expect(ids).not.toContain(guest.id)
  })
})
