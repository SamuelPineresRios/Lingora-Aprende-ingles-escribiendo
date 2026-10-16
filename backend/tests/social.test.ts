/**
 * Tests de competición social: amistades, liga privada y retos 1v1.
 *
 * Lo importante: que el código de amigo sea estable, que las solicitudes no
 * se dupliquen ni crucen mal, que la liga ordene por la métrica pedida y que
 * un reto guarde la nota de cada jugador y derive al ganador.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { createApp } from '../src/app.ts'
import { db } from '../src/db/client.ts'
import { evaluations, responses } from '../src/db/schema.ts'
import { createChallenge, recordChallengeScore } from '../src/modules/social/service.ts'
import { resetDb } from './helpers/db.ts'
import { createMission, signupActor, type Actor } from './helpers/fixtures.ts'

const app = createApp()

/** Rellena el historial de un alumno con XP y misiones completadas. */
async function giveStats(studentId: string, missionId: string, xp: number): Promise<void> {
  const responseId = randomUUID()
  await db.insert(responses).values({
    id: responseId,
    mission_id: missionId,
    student_id: studentId,
    text_content: 'A test answer',
    status: 'completed',
    time_taken_seconds: 90,
  })
  await db.insert(evaluations).values({
    id: randomUUID(),
    response_id: responseId,
    comprehensibility_score: 80,
    grammar_score: 80,
    lexical_richness_score: 80,
    judgment: 'ADVANCE',
    feedback_text: 'Bien',
    detected_structures: [],
    xp_awarded: xp,
  })
}

/** Empareja a dos alumnos por código (solicitud de b + aceptación de a). */
async function befriend(a: Actor, b: Actor): Promise<void> {
  const aCode = (await a.agent.get('/api/social/me')).body.code
  const res = await b.agent.post('/api/social/friends/request').send({ code: aCode })
  expect(res.status).toBe(201)
  const aView = await a.agent.get('/api/social/me')
  const incoming = aView.body.incoming.find((person: { id: string }) => person.id === b.id)
  const accepted = await a.agent.post('/api/social/friends/respond').send({ request_id: incoming.request_id, accept: true })
  expect(accepted.status).toBe(200)
}

beforeEach(async () => {
  await resetDb()
})

describe('amistades', () => {
  it('cada alumno tiene un código estable de seis caracteres', async () => {
    const student = await signupActor(app, 'student')
    const first = await student.agent.get('/api/social/me')
    const second = await student.agent.get('/api/social/me')

    expect(first.status).toBe(200)
    expect(first.body.code).toMatch(/^[A-Z2-9]{6}$/)
    expect(second.body.code).toBe(first.body.code)
    expect(first.body.friends).toEqual([])
  })

  it('una solicitud por código llega al otro y al aceptarla son amigos', async () => {
    const ana = await signupActor(app, 'student', { full_name: 'Ana' })
    const luis = await signupActor(app, 'student', { full_name: 'Luis' })
    const code = (await ana.agent.get('/api/social/me')).body.code

    const sent = await luis.agent.post('/api/social/friends/request').send({ code })
    expect(sent.status).toBe(201)
    expect(sent.body.status).toBe('pending')

    const anaView = await ana.agent.get('/api/social/me')
    expect(anaView.body.incoming.map((person: { id: string }) => person.id)).toContain(luis.id)

    const accepted = await ana.agent
      .post('/api/social/friends/respond')
      .send({ request_id: anaView.body.incoming[0].request_id, accept: true })
    expect(accepted.status).toBe(200)

    const luisView = await luis.agent.get('/api/social/me')
    expect(luisView.body.friends.map((person: { id: string }) => person.id)).toContain(ana.id)
  })

  it('si el otro ya te había pedido, pedirle tú equivale a aceptar', async () => {
    const ana = await signupActor(app, 'student')
    const luis = await signupActor(app, 'student')
    const anaCode = (await ana.agent.get('/api/social/me')).body.code
    const luisCode = (await luis.agent.get('/api/social/me')).body.code

    await luis.agent.post('/api/social/friends/request').send({ code: anaCode })
    const back = await ana.agent.post('/api/social/friends/request').send({ code: luisCode })

    expect(back.status).toBe(201)
    expect(back.body.status).toBe('accepted')
    const luisView = await luis.agent.get('/api/social/me')
    expect(luisView.body.friends.map((person: { id: string }) => person.id)).toContain(ana.id)
  })

  it('rechaza tu propio código, códigos desconocidos y duplicados', async () => {
    const ana = await signupActor(app, 'student')
    const luis = await signupActor(app, 'student')
    const anaCode = (await ana.agent.get('/api/social/me')).body.code

    expect((await ana.agent.post('/api/social/friends/request').send({ code: anaCode })).status).toBe(400)
    expect((await ana.agent.post('/api/social/friends/request').send({ code: 'ZZZZZZ' })).status).toBe(404)

    await luis.agent.post('/api/social/friends/request').send({ code: anaCode })
    const dup = await luis.agent.post('/api/social/friends/request').send({ code: anaCode })
    expect(dup.status).toBe(409)
  })

  it('sin sesión no se puede usar la API social', async () => {
    const res = await request(app).get('/api/social/me')
    expect(res.status).toBe(401)
  })
})

describe('liga privada', () => {
  it('ordena a los amigos por la métrica pedida y marca posiciones', async () => {
    const ana = await signupActor(app, 'student', { full_name: 'Ana' })
    const luis = await signupActor(app, 'student', { full_name: 'Luis' })
    const missionId = await createMission({ id: 'm-social-1' })
    await giveStats(ana.id, missionId, 120)
    await giveStats(luis.id, missionId, 40)
    await befriend(ana, luis)

    const league = await ana.agent.get('/api/social/league?metric=xp')
    expect(league.status).toBe(200)
    const names = league.body.entries.map((entry: { name: string }) => entry.name)
    expect(names).toEqual(['Ana', 'Luis'])
    expect(league.body.entries[0].position).toBe(1)
    expect(league.body.entries[0].xp).toBe(120)

    const byTime = await luis.agent.get('/api/social/league?metric=time')
    // Ambos tienen 90 s: el desempate es por XP, así que Ana va delante.
    expect(byTime.body.entries[0].name).toBe('Ana')
  })
})

describe('retos 1v1', () => {
  it('solo se puede retar a un amigo y no se duplican los retos activos', async () => {
    const ana = await signupActor(app, 'student')
    const luis = await signupActor(app, 'student')
    const missionId = await createMission({ id: 'm-social-2' })

    const notFriends = await ana.agent.post('/api/social/challenges').send({ opponent_id: luis.id, mission_id: missionId })
    expect(notFriends.status).toBe(403)

    await befriend(ana, luis)
    const created = await ana.agent.post('/api/social/challenges').send({ opponent_id: luis.id, mission_id: missionId })
    expect(created.status).toBe(201)

    const dup = await ana.agent.post('/api/social/challenges').send({ opponent_id: luis.id, mission_id: missionId })
    expect(dup.status).toBe(409)
  })

  it('guarda la nota de cada jugador y deriva al ganador al terminar', async () => {
    const ana = await signupActor(app, 'student')
    const luis = await signupActor(app, 'student')
    const missionId = await createMission({ id: 'm-social-3' })
    await befriend(ana, luis)
    const { id } = await createChallenge(ana.id, luis.id, missionId)

    await recordChallengeScore(ana.id, missionId, 80)
    let view = (await ana.agent.get('/api/social/challenges')).body.challenges[0]
    expect(view.state).toBe('waiting_them')
    expect(view.my_score).toBe(80)

    await recordChallengeScore(luis.id, missionId, 90)
    view = (await luis.agent.get('/api/social/challenges')).body.challenges.find((c: { id: string }) => c.id === id)
    expect(view.state).toBe('finished')
    expect(view.winner).toBe('me')
    expect(view.direction).toBe('incoming')

    const anaView = (await ana.agent.get('/api/social/challenges')).body.challenges[0]
    expect(anaView.winner).toBe('them')
  })

  it('el retado puede rechazar mientras no haya jugado', async () => {
    const ana = await signupActor(app, 'student')
    const luis = await signupActor(app, 'student')
    const missionId = await createMission({ id: 'm-social-4' })
    await befriend(ana, luis)
    const { id } = await createChallenge(ana.id, luis.id, missionId)

    const declined = await luis.agent.post(`/api/social/challenges/${id}/decline`)
    expect(declined.status).toBe(200)
    const view = (await ana.agent.get('/api/social/challenges')).body.challenges[0]
    expect(view.state).toBe('declined')

    // Ya no se puede rechazar dos veces: el reto ya no está pendiente.
    expect((await luis.agent.post(`/api/social/challenges/${id}/decline`)).status).toBe(409)
  })
})
