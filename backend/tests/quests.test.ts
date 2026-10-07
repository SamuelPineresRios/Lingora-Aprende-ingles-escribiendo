/**
 * Tests de retos diarios, cofre y reto semanal.
 *
 * Lo importante: que el progreso salga de la actividad real del periodo, que
 * no se pueda reclamar sin completar ni dos veces, y que el cofre pague solo
 * con los tres retos del día reclamados.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createApp } from '../src/app.ts'
import { db } from '../src/db/client.ts'
import { evaluations, responses } from '../src/db/schema.ts'
import { DAILY_CHEST, DAILY_QUESTS } from '../src/lib/quests.ts'
import { resetDb } from './helpers/db.ts'
import { createMission, signupActor, type Actor } from './helpers/fixtures.ts'

const app = createApp()
const TZ = 'UTC'

/** Misión completada hoy con XP y tiempo conocidos. */
async function seedToday(student: Actor, { xp, seconds }: { xp: number; seconds: number }): Promise<void> {
  const mission = await createMission({ cefr_level: 'B1' })
  const responseId = randomUUID()

  await db.insert(responses).values({
    id: responseId,
    mission_id: mission,
    student_id: student.id,
    text_content: 'texto',
    input_mode: 'text',
    transcript: null,
    time_taken_seconds: seconds,
    submitted_at: new Date(),
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
    evaluated_at: new Date(),
    xp_awarded: xp,
  })
}

beforeEach(async () => {
  await resetDb()
})

describe('GET /api/students/:id/quests', () => {
  it('deriva el progreso de la actividad del día y de la semana', async () => {
    const ana = await signupActor(app, 'student')
    await seedToday(ana, { xp: 120, seconds: 700 })

    const res = await ana.agent.get(`/api/students/${ana.id}/quests?tz=${TZ}`)

    expect(res.status).toBe(200)
    const porId = Object.fromEntries(
      (res.body.day.quests as Array<{ id: string; progress: number; done: boolean; claimed: boolean }>).map(quest => [
        quest.id,
        quest,
      ]),
    )
    expect(porId['diaria-mision']).toMatchObject({ progress: 1, done: true, claimed: false })
    expect(porId['diaria-xp']).toMatchObject({ progress: 100, done: true })
    expect(porId['diaria-minutos']).toMatchObject({ progress: 10, done: true })
    expect(res.body.week.quests[0]).toMatchObject({ progress: 1, done: false })
    expect(res.body.balance).toBe(0)
  })

  it('sin actividad, nada está completo', async () => {
    const ana = await signupActor(app, 'student')
    await createMission({ cefr_level: 'B1' }) // misiones sin respuestas no cuentan

    const res = await ana.agent.get(`/api/students/${ana.id}/quests?tz=${TZ}`)

    expect(res.body.day.quests.every((quest: { done: boolean }) => !quest.done)).toBe(true)
    expect(res.body.day.chest).toMatchObject({ ready: false, claimed: false, coins: DAILY_CHEST.coins })
  })
})

describe('POST /api/students/:id/quests/:questId/claim', () => {
  it('reclama un reto completado, paga y no deja repetir', async () => {
    const ana = await signupActor(app, 'student')
    await seedToday(ana, { xp: 120, seconds: 700 })

    const primera = await ana.agent.post(`/api/students/${ana.id}/quests/diaria-mision/claim?tz=${TZ}`)
    expect(primera.status).toBe(200)
    expect(primera.body.balance).toBe(30)
    expect(primera.body.day.quests.find((quest: { id: string }) => quest.id === 'diaria-mision').claimed).toBe(true)

    const repetida = await ana.agent.post(`/api/students/${ana.id}/quests/diaria-mision/claim?tz=${TZ}`)
    expect(repetida.status).toBe(400)
    expect(repetida.body.error).toBe('Ese reto ya está reclamado')
  })

  it('no deja reclamar lo que falta ni abrir el cofre antes de tiempo', async () => {
    const ana = await signupActor(app, 'student')

    const sinHacer = await ana.agent.post(`/api/students/${ana.id}/quests/diaria-mision/claim?tz=${TZ}`)
    expect(sinHacer.status).toBe(400)
    expect(sinHacer.body.error).toBe('Todavía no completaste ese reto')

    await seedToday(ana, { xp: 120, seconds: 700 })
    const cofrePronto = await ana.agent.post(`/api/students/${ana.id}/quests/${DAILY_CHEST.id}/claim?tz=${TZ}`)
    expect(cofrePronto.status).toBe(400)
    expect(cofrePronto.body.error).toContain('Completa los tres retos')
  })

  it('abre el cofre con los tres retos reclamados', async () => {
    const ana = await signupActor(app, 'student')
    await seedToday(ana, { xp: 120, seconds: 700 })

    for (const quest of DAILY_QUESTS) {
      const res = await ana.agent.post(`/api/students/${ana.id}/quests/${quest.id}/claim?tz=${TZ}`)
      expect(res.status).toBe(200)
    }

    const cofre = await ana.agent.post(`/api/students/${ana.id}/quests/${DAILY_CHEST.id}/claim?tz=${TZ}`)
    expect(cofre.status).toBe(200)
    expect(cofre.body.balance).toBe(30 + 40 + 30 + DAILY_CHEST.coins)
    expect(cofre.body.day.chest.claimed).toBe(true)

    const repetido = await ana.agent.post(`/api/students/${ana.id}/quests/${DAILY_CHEST.id}/claim?tz=${TZ}`)
    expect(repetido.status).toBe(400)
  })

  it('el reto semanal paga con cinco misiones y respeta permisos', async () => {
    const ana = await signupActor(app, 'student')
    const luis = await signupActor(app, 'student')
    const teacher = await signupActor(app, 'teacher')

    for (let i = 0; i < 5; i++) await seedToday(ana, { xp: 60, seconds: 120 })

    expect((await luis.agent.get(`/api/students/${ana.id}/quests?tz=${TZ}`)).status).toBe(403)
    expect((await teacher.agent.get(`/api/students/${ana.id}/quests?tz=${TZ}`)).status).toBe(200)
    expect((await teacher.agent.post(`/api/students/${ana.id}/quests/semanal-misiones/claim?tz=${TZ}`)).status).toBe(403)

    const res = await ana.agent.post(`/api/students/${ana.id}/quests/semanal-misiones/claim?tz=${TZ}`)
    expect(res.status).toBe(200)
    expect(res.body.balance).toBe(120)
    expect(res.body.week.quests[0].claimed).toBe(true)
  })
})
