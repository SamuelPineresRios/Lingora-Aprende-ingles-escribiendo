/**
 * Tests de integración de misiones.
 *
 * Sin `ANTHROPIC_API_KEY` (entorno de test) la evaluación cae al respaldo
 * técnico: puntuación 65 con judgment PAUSE. Eso permite comprobar el umbral
 * por nivel de forma determinista: 65 completa A1 (umbral 60) pero no B1 (80).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.ts'
import { sql } from '../src/db/client.ts'
import { resetDb } from './helpers/db.ts'
import { createIntroduction, createMission, recordMissionCompletion, signupActor, TEST_BACKDROP } from './helpers/fixtures.ts'

const app = createApp()

beforeEach(async () => {
  await resetDb()
})

describe('GET /api/missions', () => {
  it('responde 401 sin sesión', async () => {
    const res = await request(app).get('/api/missions')

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'Unauthorized' })
  })

  it('incluye el fondo de la introducción y null cuando no hay escena', async () => {
    const student = await signupActor(app, 'student')
    await createMission({ id: 'mission-a' })
    await createMission({ id: 'mission-b' })
    await createIntroduction('mission-a')

    const res = await student.agent.get('/api/missions')

    expect(res.status).toBe(200)
    const conFondo = res.body.missions.find((m: { id: string }) => m.id === 'mission-a')
    const sinFondo = res.body.missions.find((m: { id: string }) => m.id === 'mission-b')
    expect(conFondo.backdrop).toEqual(TEST_BACKDROP)
    expect(sinFondo.backdrop).toBeNull()
  })

  it('devuelve las misiones ordenadas con estado not_started', async () => {
    const student = await signupActor(app, 'student', { cefr_level: 'A2' })
    await createMission({ id: 'mission-b' })
    await createMission({ id: 'mission-a' })

    const res = await student.agent.get('/api/missions')

    expect(res.status).toBe(200)
    expect(res.body.cefr_level).toBe('A2')
    expect(res.body.missions.map((m: { id: string }) => m.id)).toEqual(['mission-a', 'mission-b'])
    expect(res.body.missions[0].status).toBe('not_started')
  })

  it('solo está completada cuando se hace el Desafío', async () => {
    const student = await signupActor(app, 'student')
    const missionId = await createMission()

    await student.agent.post(`/api/missions/${missionId}/mark-completed`).send({})
    await recordMissionCompletion(student.id, missionId, { challenge: false })
    expect((await student.agent.get('/api/missions')).body.missions[0].status).toBe('challenge_pending')

    await recordMissionCompletion(student.id, missionId, { challenge: true })
    expect((await student.agent.get('/api/missions')).body.missions[0].status).toBe('completed')
  })
})

describe('GET /api/missions/:id', () => {
  it('devuelve la misión y narrative_state null', async () => {
    const student = await signupActor(app, 'student')
    const missionId = await createMission()

    const res = await student.agent.get(`/api/missions/${missionId}`)

    expect(res.status).toBe(200)
    expect(res.body.mission.id).toBe(missionId)
    expect(res.body.narrative_state).toBeNull()
  })

  it('responde 404 si la misión no existe', async () => {
    const student = await signupActor(app, 'student')

    const res = await student.agent.get('/api/missions/no-existe')

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Mission not found' })
  })
})

describe('POST /api/missions/:id/submit', () => {
  it('responde 401 sin sesión', async () => {
    const res = await request(app).post('/api/missions/x/submit').send({ response_text: 'Hi there' })

    expect(res.status).toBe(401)
  })

  it('exige response_text', async () => {
    const student = await signupActor(app, 'student')
    const missionId = await createMission()

    const res = await student.agent.post(`/api/missions/${missionId}/submit`).send({})

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'response_text required' })
  })

  it('responde 404 si la misión no existe', async () => {
    const student = await signupActor(app, 'student')

    const res = await student.agent
      .post('/api/missions/no-existe/submit')
      .send({ response_text: 'My name is Ana and I am from Peru.' })

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Mission not found' })
  })

  it('rechaza respuestas no serias sin llamar a la IA', async () => {
    const student = await signupActor(app, 'student')
    const missionId = await createMission()

    const res = await student.agent
      .post(`/api/missions/${missionId}/submit`)
      .send({ response_text: 'hahaha' })

    expect(res.status).toBe(200)
    expect(res.body.judgment).toBe('PAUSE')
    expect(res.body.comprehensibility_score).toBe(15)
    expect(res.body.mission_completed).toBe(false)
    expect(res.body.correctedText).toContain('respuesta seria')

    const [row] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM responses
    `
    expect(row?.count).toBe(1)
  })

  it('con el respaldo (65 pts) completa una misión de A1 pero no una de B1', async () => {
    const studentA1 = await signupActor(app, 'student', { cefr_level: 'A1' })
    const studentB1 = await signupActor(app, 'student', { cefr_level: 'B1' })
    const missionId = await createMission()

    const a1 = await studentA1.agent
      .post(`/api/missions/${missionId}/submit`)
      .send({ response_text: 'My name is Ana and I am from Peru.', time_taken_seconds: 42 })
    const b1 = await studentB1.agent
      .post(`/api/missions/${missionId}/submit`)
      .send({ response_text: 'My name is Ana and I am from Peru.' })

    expect(a1.status).toBe(200)
    expect(b1.status).toBe(200)
    expect(a1.body.judgment).toBe('PAUSE')
    expect(a1.body.evaluation.comprehensibility_score).toBe(65)

    const a1Missions = await studentA1.agent.get('/api/missions')
    const b1Missions = await studentB1.agent.get('/api/missions')
    expect(a1Missions.body.missions[0].status).toBe('completed')
    // 65 < 80 (umbral B1): la misión queda pausada, no completada.
    expect(b1Missions.body.missions[0].status).toBe('paused')
  })

  it('acumula el agregado semanal con el upsert', async () => {
    const student = await signupActor(app, 'student', { cefr_level: 'A1' })
    const missionA = await createMission({ id: 'mission-a' })
    const missionB = await createMission({ id: 'mission-b' })

    await student.agent
      .post(`/api/missions/${missionA}/submit`)
      .send({ response_text: 'My name is Ana and I am from Peru.', time_taken_seconds: 30 })
    await student.agent
      .post(`/api/missions/${missionB}/submit`)
      .send({ response_text: 'I live in Lima and I study English.', time_taken_seconds: 12 })

    const summary = await student.agent.get(`/api/students/${student.id}/session-summary`)

    expect(summary.status).toBe(200)
    expect(summary.body.today_writing_seconds).toBe(42)
    expect(summary.body.missions_completed_this_week).toBe(2)
    expect(summary.body.avg_comprehensibility).toBe(65)
  })
})

describe('POST /api/missions/:id/mark-completed', () => {
  it('responde 404 si la misión no existe', async () => {
    const student = await signupActor(app, 'student')

    const res = await student.agent.post('/api/missions/no-existe/mark-completed').send({})

    expect(res.status).toBe(404)
  })

  it('promociona de nivel al completar todas las misiones del nivel actual', async () => {
    const student = await signupActor(app, 'student', { cefr_level: 'A1' })
    const first = await createMission({ id: 'mission-a1-1', cefr_level: 'A1' })
    const second = await createMission({ id: 'mission-a1-2', cefr_level: 'A1' })
    await createMission({ id: 'mission-b1-1', cefr_level: 'B1' })

    await student.agent.post(`/api/missions/${first}/mark-completed`).send({})

    const halfway = await student.agent.get('/api/missions')
    expect(halfway.body.cefr_level).toBe('A1')

    await student.agent.post(`/api/missions/${second}/mark-completed`).send({})

    const promoted = await student.agent.get('/api/missions')
    expect(promoted.body.cefr_level).toBe('A2')
  })
})
