/**
 * Tests de temporadas y pase de batalla.
 *
 * Lo importante: que las fechas roten solas cada 4 semanas, que el XP cuente
 * en la temporada en que se envió, que las casillas se calculen con 400 XP y
 * que las recompensas se desbloqueen en su casilla.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { createApp } from '../src/app.ts'
import { db } from '../src/db/client.ts'
import { evaluations, responses } from '../src/db/schema.ts'
import { SEASON_REWARDS, coinsForXp, seasonFor, tierFromXp, MAX_TIER, TIER_XP } from '../src/lib/season.ts'
import { resetDb } from './helpers/db.ts'
import { createMission, signupActor, type Actor } from './helpers/fixtures.ts'

const app = createApp()

/** Respuesta evaluada con XP y fecha conocidos. */
async function seedActivity(student: Actor, missionId: string, xp: number, submittedAt: Date): Promise<void> {
  const responseId = randomUUID()
  await db.insert(responses).values({
    id: responseId,
    mission_id: missionId,
    student_id: student.id,
    text_content: 'texto',
    input_mode: 'text',
    transcript: null,
    time_taken_seconds: 120,
    submitted_at: submittedAt,
    status: 'completed',
  })
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
    evaluated_at: submittedAt,
    xp_awarded: xp,
  })
}

const DAY_MS = 24 * 60 * 60 * 1000
const EPOCH = new Date('2026-10-05T00:00:00Z')

beforeEach(async () => {
  await resetDb()
})

describe('motor de temporadas', () => {
  it('rota cada 4 semanas desde la fecha anclada', () => {
    const inicio = seasonFor(EPOCH)
    expect(inicio.number).toBe(1)
    expect(inicio.startsAt.toISOString()).toBe('2026-10-05T00:00:00.000Z')
    expect(inicio.endsAt.toISOString()).toBe('2026-11-01T23:59:59.999Z')

    // El último día sigue en la temporada 1; el siguiente ya es la 2.
    expect(seasonFor(new Date(EPOCH.getTime() + 27 * DAY_MS)).number).toBe(1)
    const segunda = seasonFor(new Date(EPOCH.getTime() + 28 * DAY_MS))
    expect(segunda.number).toBe(2)
    expect(segunda.startsAt.toISOString()).toBe('2026-11-02T00:00:00.000Z')

    // Fechas anteriores al ancla caen en la temporada 1 (no hay temporada 0).
    expect(seasonFor(new Date(EPOCH.getTime() - 10 * DAY_MS)).number).toBe(1)
  })

  it('calcula la casilla con 400 XP y la topa en 20', () => {
    expect(tierFromXp(0)).toBe(0)
    expect(tierFromXp(TIER_XP - 1)).toBe(0)
    expect(tierFromXp(TIER_XP)).toBe(1)
    expect(tierFromXp(TIER_XP * 12)).toBe(12)
    expect(tierFromXp(TIER_XP * 999)).toBe(MAX_TIER)
  })

  it('suma las monedas de las casillas alcanzadas', () => {
    expect(coinsForXp(0)).toBe(0)
    expect(coinsForXp(TIER_XP - 1)).toBe(0)
    // Casilla 1 (25) y casilla 3 (40); la 2 es insignia y la 4 un marco.
    expect(coinsForXp(TIER_XP * 3)).toBe(65)
    expect(coinsForXp(TIER_XP * MAX_TIER)).toBe(1190)
  })

  it('el catálogo tiene una recompensa por casilla', () => {
    expect(SEASON_REWARDS).toHaveLength(MAX_TIER)
    expect(SEASON_REWARDS.map(reward => reward.tier)).toEqual(
      Array.from({ length: MAX_TIER }, (_, index) => index + 1),
    )
  })
})

describe('GET /api/students/:id/season', () => {
  it('exige sesión y que el recurso sea propio (o docente)', async () => {
    const ana = await signupActor(app, 'student')
    const luis = await signupActor(app, 'student')
    const teacher = await signupActor(app, 'teacher')

    expect((await request(app).get(`/api/students/${ana.id}/season`)).status).toBe(401)
    expect((await luis.agent.get(`/api/students/${ana.id}/season`)).status).toBe(403)
    expect((await teacher.agent.get(`/api/students/${ana.id}/season`)).status).toBe(200)
  })

  it('cuenta el XP de la temporada, la casilla y las recompensas', async () => {
    const ana = await signupActor(app, 'student')
    const mission = await createMission({ cefr_level: 'B1' })

    await seedActivity(ana, mission, 500, new Date())

    const res = await ana.agent.get(`/api/students/${ana.id}/season`)

    expect(res.status).toBe(200)
    expect(res.body.season.number).toBe(1)
    expect(res.body.xp).toBe(500)
    expect(res.body.tier).toBe(1)
    expect(res.body.tier_xp).toBe(100)
    expect(res.body.tier_span).toBe(400)
    expect(res.body.xp_to_next_tier).toBe(300)
    expect(res.body.coins).toBe(25)
    expect(res.body.season.days_left).toBeGreaterThan(0)
    expect(res.body.rewards).toHaveLength(20)
    expect(res.body.rewards[0]).toMatchObject({ tier: 1, kind: 'coins', coins: 25, unlocked: true })
    expect(res.body.rewards[1]).toMatchObject({ tier: 2, kind: 'badge', unlocked: false })
    expect(res.body.rewards[3]).toMatchObject({ tier: 4, kind: 'frame', id: 'bronce', unlocked: false })
  })

  it('el XP de otra temporada no cuenta en la actual, pero sus monedas sí se acumulan', async () => {
    const ana = await signupActor(app, 'student')
    const mission = await createMission({ cefr_level: 'B1' })

    // 1200 XP dentro de la temporada actual y 800 en la siguiente (fecha futura).
    await seedActivity(ana, mission, 1200, new Date())
    await seedActivity(ana, mission, 800, new Date(Date.now() + 40 * DAY_MS))

    const res = await ana.agent.get(`/api/students/${ana.id}/season`)

    expect(res.body.xp).toBe(1200)
    expect(res.body.tier).toBe(3)
    // Monedas: casillas 1 y 3 de la temporada actual (65) + casilla 1 de la otra (25).
    expect(res.body.coins).toBe(90)
  })
})
