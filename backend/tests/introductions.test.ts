/**
 * Tests del módulo de introducciones narrativas.
 *
 * Lo importante aquí: que la escena se genere UNA vez por misión (la llamada
 * al modelo es cara), que el modelo se valide y que sólo los docentes puedan
 * regenerarla.
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

import request from 'supertest'
import { completeChat } from '../src/lib/ai.ts'
import { createApp } from '../src/app.ts'
import { sql } from '../src/db/client.ts'
import { resetDb } from './helpers/db.ts'
import { createMission, signupActor } from './helpers/fixtures.ts'

const app = createApp()
const mockedCompleteChat = vi.mocked(completeChat)

/** Escena válida de ejemplo, como la devolvería el modelo. */
function validScene(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    scene_title: 'Llamada al soporte',
    scene_description: 'Una oficina moderna con un computador averiado.',
    characters: [
      { id: 'A', name: 'Tech Support', role: 'Agente de soporte', emoji: '🖥️', played_by: 'ai' },
      { id: 'B', name: 'Alex', role: 'Empleado', emoji: '👨‍💼', played_by: 'student' },
    ],
    lines: [
      { speaker: 'A', text: 'How can I help you today?', translation: '¿Cómo puedo ayudarte?' },
      { speaker: 'B', text: 'My computer will not turn on.', translation: 'Mi computador no enciende.' },
      { speaker: 'A', text: 'Did anything happen before?', translation: '¿Pasó algo antes?' },
      { speaker: 'B', text: 'I heard a strange noise.', translation: 'Escuché un ruido extraño.' },
    ],
    useful_expressions: ['My computer will not turn on', 'I heard a strange noise', 'Can you help me?'],
    backdrop: {
      kind: 'office',
      style: 'blueprint',
      light: 'night',
      palette: ['#0b1f33', '#123a5c', '#22d3ee'],
      props: ['skyline'],
    },
    ...overrides,
  })
}

beforeEach(async () => {
  await resetDb()
  mockedCompleteChat.mockReset()
})

describe('GET /api/missions/:id/introduction', () => {
  it('responde 401 sin sesión', async () => {
    const res = await request(app).get('/api/missions/m-1/introduction')

    expect(res.status).toBe(401)
  })

  it('responde 404 si la misión no existe', async () => {
    const student = await signupActor(app, 'student')

    const res = await student.agent.get('/api/missions/no-existe/introduction')

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Mission not found' })
  })

  it('genera la escena la primera vez y la guarda', async () => {
    mockedCompleteChat.mockResolvedValue(validScene())

    const student = await signupActor(app, 'student')
    const missionId = await createMission({ id: 'm-1', character_name: 'Tech Support' })

    const res = await student.agent.get(`/api/missions/${missionId}/introduction`)

    expect(res.status).toBe(200)
    expect(res.body.introduction.scene_title).toBe('Llamada al soporte')
    expect(res.body.introduction.lines).toHaveLength(4)
    expect(res.body.introduction.characters).toHaveLength(2)
    expect(res.body.introduction.backdrop).toEqual({
      kind: 'office',
      style: 'blueprint',
      light: 'night',
      palette: ['#0b1f33', '#123a5c', '#22d3ee'],
      props: ['skyline'],
    })
    expect(mockedCompleteChat).toHaveBeenCalledTimes(1)

    const [row] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM mission_introductions
    `
    expect(row?.count).toBe(1)
  })

  it('un fondo inválido no tumba la escena: se guarda sin fondo', async () => {
    mockedCompleteChat.mockResolvedValue(
      validScene({
        backdrop: {
          kind: 'holodeck',
          style: 'blueprint',
          light: 'night',
          palette: ['no-es-color', '#123456', '#654321'],
        },
      }),
    )

    const student = await signupActor(app, 'student')
    const missionId = await createMission({ id: 'm-1' })

    const res = await student.agent.get(`/api/missions/${missionId}/introduction`)

    expect(res.status).toBe(200)
    expect(res.body.introduction.backdrop).toBeNull()
  })

  it('la segunda vez usa la guardada y NO vuelve a llamar al modelo', async () => {
    mockedCompleteChat.mockResolvedValue(validScene())

    const student = await signupActor(app, 'student')
    const missionId = await createMission({ id: 'm-1' })

    await student.agent.get(`/api/missions/${missionId}/introduction`)
    const second = await student.agent.get(`/api/missions/${missionId}/introduction`)

    expect(second.status).toBe(200)
    expect(second.body.introduction.scene_title).toBe('Llamada al soporte')
    expect(mockedCompleteChat).toHaveBeenCalledTimes(1)
  })

  it('la comparten todos los alumnos: otro alumno no paga otra generación', async () => {
    mockedCompleteChat.mockResolvedValue(validScene())

    const first = await signupActor(app, 'student')
    const second = await signupActor(app, 'student')
    const missionId = await createMission({ id: 'm-1' })

    await first.agent.get(`/api/missions/${missionId}/introduction`)
    const res = await second.agent.get(`/api/missions/${missionId}/introduction`)

    expect(res.status).toBe(200)
    expect(mockedCompleteChat).toHaveBeenCalledTimes(1)
  })

  it('rechaza una escena con menos líneas de las exigidas', async () => {
    mockedCompleteChat.mockResolvedValue(
      validScene({ lines: [{ speaker: 'A', text: 'Hi', translation: 'Hola' }] }),
    )

    const student = await signupActor(app, 'student')
    const missionId = await createMission({ id: 'm-1' })

    const res = await student.agent.get(`/api/missions/${missionId}/introduction`)

    expect(res.status).toBe(502)
    expect(res.body).toEqual({ error: 'La escena generada no es utilizable' })
  })

  it('rechaza una escena sin exactamente un personaje de cada tipo', async () => {
    mockedCompleteChat.mockResolvedValue(
      validScene({
        characters: [
          { id: 'A', name: 'Uno', role: 'x', emoji: '🙂', played_by: 'ai' },
          { id: 'B', name: 'Dos', role: 'y', emoji: '🙂', played_by: 'ai' },
        ],
      }),
    )

    const student = await signupActor(app, 'student')
    const missionId = await createMission({ id: 'm-1' })

    const res = await student.agent.get(`/api/missions/${missionId}/introduction`)

    expect(res.status).toBe(502)
  })

  it('rechaza expresiones fuera del rango permitido', async () => {
    mockedCompleteChat.mockResolvedValue(validScene({ useful_expressions: ['una sola'] }))

    const student = await signupActor(app, 'student')
    const missionId = await createMission({ id: 'm-1' })

    const res = await student.agent.get(`/api/missions/${missionId}/introduction`)

    expect(res.status).toBe(502)
  })
})

describe('POST /api/missions/:id/introduction/regenerate', () => {
  it('responde 403 a un alumno', async () => {
    const student = await signupActor(app, 'student')
    const missionId = await createMission({ id: 'm-1' })

    const res = await student.agent.post(`/api/missions/${missionId}/introduction/regenerate`)

    expect(res.status).toBe(403)
    expect(mockedCompleteChat).not.toHaveBeenCalled()
  })

  it('un docente regenera: sube la versión y llama al modelo otra vez', async () => {
    mockedCompleteChat.mockResolvedValue(validScene())

    const student = await signupActor(app, 'student')
    const teacher = await signupActor(app, 'teacher')
    const missionId = await createMission({ id: 'm-1' })

    await student.agent.get(`/api/missions/${missionId}/introduction`)

    mockedCompleteChat.mockResolvedValue(validScene({ scene_title: 'Otra escena' }))
    const res = await teacher.agent.post(`/api/missions/${missionId}/introduction/regenerate`)

    expect(res.status).toBe(200)
    expect(res.body.introduction.scene_title).toBe('Otra escena')
    expect(res.body.introduction.version).toBe(2)
    expect(mockedCompleteChat).toHaveBeenCalledTimes(2)

    const [row] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM mission_introductions
    `
    expect(row?.count).toBe(1)
  })
})
