/**
 * Tests de retos diarios, cofre sorpresa, ruleta y reto semanal.
 *
 * Lo importante: que el progreso salga de la actividad real del periodo, que
 * no se pueda reclamar sin completar ni dos veces, que el cofre pague un
 * premio del catálogo (monedas o escudo) y que la sorpresa del día dé su
 * bonus de XP una sola vez.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { createApp } from '../src/app.ts'
import { db } from '../src/db/client.ts'
import { daily_surprises, evaluations, responses, saved_words, streak_shields, word_lookups } from '../src/db/schema.ts'
import { CHEST_REWARDS, DAILY_CHEST, DAILY_QUESTS, rollChestReward } from '../src/lib/quests.ts'
import { consumeSurpriseBonus } from '../src/modules/quests/service.ts'
import { resetDb } from './helpers/db.ts'
import { createMission, signupActor, type Actor } from './helpers/fixtures.ts'

const app = createApp()
const TZ = 'UTC'

/** Misión completada hoy con XP, tiempo y notas conocidos. */
async function seedToday(
  student: Actor,
  { xp, seconds, scores = 80 }: { xp: number; seconds: number; scores?: number },
): Promise<string> {
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
    comprehensibility_score: scores,
    grammar_score: scores,
    lexical_richness_score: scores,
    judgment: 'ADVANCE',
    feedback_text: 'texto',
    detected_structures: [],
    transcript: null,
    evaluated_at: new Date(),
    xp_awarded: xp,
  })
  return mission
}

/** Guarda `count` palabras nuevas hoy (para el reto de vocabulario). */
async function seedWords(student: Actor, count: number): Promise<void> {
  for (let index = 0; index < count; index++) {
    const lookupId = randomUUID()
    await db.insert(word_lookups).values({
      id: lookupId,
      word: `palabra-${index}-${randomUUID().slice(0, 6)}`,
      translation: 'palabra',
      part_of_speech: 'noun',
      examples: [],
      created_at: new Date(),
    })
    await db.insert(saved_words).values({
      id: randomUUID(),
      student_id: student.id,
      word_lookup_id: lookupId,
      created_at: new Date(),
    })
  }
}

beforeEach(async () => {
  await resetDb()
})

describe('GET /api/students/:id/quests', () => {
  it('deriva el progreso de la actividad del día y de la semana', async () => {
    const ana = await signupActor(app, 'student')
    await seedToday(ana, { xp: 120, seconds: 700 })
    await seedWords(ana, 2)

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
    expect(porId['diaria-palabras']).toMatchObject({ progress: 2, done: true })
    expect(res.body.week.quests[0]).toMatchObject({ progress: 1, done: false })
    expect(res.body.balance).toBe(0)
    expect(res.body.day.surprise).toBeNull()
  })

  it('sin actividad, nada está completo', async () => {
    const ana = await signupActor(app, 'student')
    await createMission({ cefr_level: 'B1' }) // misiones sin respuestas no cuentan

    const res = await ana.agent.get(`/api/students/${ana.id}/quests?tz=${TZ}`)

    expect(res.body.day.quests.every((quest: { done: boolean }) => !quest.done)).toBe(true)
    expect(res.body.day.chest).toMatchObject({ ready: false, claimed: false })
  })
})

describe('cofre sorpresa', () => {
  it('el sorteo respeta los pesos del catálogo', () => {
    expect(rollChestReward(0)).toMatchObject({ kind: 'coins', coins: 40 })
    expect(rollChestReward(0.39)).toMatchObject({ kind: 'coins', coins: 40 })
    expect(rollChestReward(0.4)).toMatchObject({ kind: 'coins', coins: 80 })
    expect(rollChestReward(0.7)).toMatchObject({ kind: 'coins', coins: 150 })
    expect(rollChestReward(0.9)).toMatchObject({ kind: 'coins', coins: 300 })
    expect(rollChestReward(0.999)).toMatchObject({ kind: 'shield' })
    expect(CHEST_REWARDS.reduce((sum, reward) => sum + reward.weight, 0)).toBe(100)
  })

  it('no deja reclamar lo que falta ni abrir el cofre antes de tiempo', async () => {
    const ana = await signupActor(app, 'student')

    const sinHacer = await ana.agent.post(`/api/students/${ana.id}/quests/diaria-mision/claim?tz=${TZ}`)
    expect(sinHacer.status).toBe(400)
    expect(sinHacer.body.error).toBe('Todavía no completaste ese reto')

    await seedToday(ana, { xp: 120, seconds: 700 })
    const cofrePronto = await ana.agent.post(`/api/students/${ana.id}/quests/${DAILY_CHEST.id}/claim?tz=${TZ}`)
    expect(cofrePronto.status).toBe(400)
    expect(cofrePronto.body.error).toContain('Completa todos los retos')
  })

  it('abre el cofre con los retos del día y entrega un premio del catálogo', async () => {
    const ana = await signupActor(app, 'student')
    await seedToday(ana, { xp: 120, seconds: 700 })
    await seedWords(ana, 2)

    for (const quest of DAILY_QUESTS) {
      const res = await ana.agent.post(`/api/students/${ana.id}/quests/${quest.id}/claim?tz=${TZ}`)
      expect(res.status).toBe(200)
      expect(res.body.reward).toBeNull()
    }

    const cofre = await ana.agent.post(`/api/students/${ana.id}/quests/${DAILY_CHEST.id}/claim?tz=${TZ}`)
    expect(cofre.status).toBe(200)
    expect(cofre.body.reward).toBeTruthy()
    const reward = cofre.body.reward as { kind: string; coins?: number }
    const expectedCoins = reward.kind === 'coins' ? reward.coins! : 0
    expect(cofre.body.balance).toBe(30 + 40 + 30 + 25 + expectedCoins)
    expect(cofre.body.day.chest.claimed).toBe(true)

    if (reward.kind === 'shield') {
      const shields = await db.select().from(streak_shields).where(eq(streak_shields.student_id, ana.id))
      expect(shields).toHaveLength(1)
    }

    const repetido = await ana.agent.post(`/api/students/${ana.id}/quests/${DAILY_CHEST.id}/claim?tz=${TZ}`)
    expect(repetido.status).toBe(400)
  })
})

describe('ruleta y bonus de XP', () => {
  it('gira una misión del nivel del alumno y no cambia al repetir el día', async () => {
    const ana = await signupActor(app, 'student', { cefr_level: 'A1' })
    await createMission({ id: 'm-ruleta-a1', cefr_level: 'A1' })

    const first = await ana.agent.post(`/api/students/${ana.id}/quests/surprise?tz=${TZ}`)
    expect(first.status).toBe(200)
    expect(first.body.surprise.mission.id).toBe('m-ruleta-a1')
    expect(first.body.surprise.xp_percent).toBe(150)
    expect(first.body.surprise.consumed).toBe(false)

    const again = await ana.agent.post(`/api/students/${ana.id}/quests/surprise?tz=${TZ}`)
    expect(again.body.surprise.mission.id).toBe('m-ruleta-a1')

    const view = await ana.agent.get(`/api/students/${ana.id}/quests?tz=${TZ}`)
    expect(view.body.day.surprise.mission.id).toBe('m-ruleta-a1')
  })

  it('el bonus se aplica una sola vez al completar la misión sorteada', async () => {
    const ana = await signupActor(app, 'student')
    const missionId = await createMission({ id: 'm-bonus', cefr_level: 'B1' })
    await db.insert(daily_surprises).values({
      id: randomUUID(),
      student_id: ana.id,
      day_key: new Date().toISOString().slice(0, 10),
      mission_id: missionId,
      xp_percent: 150,
      created_at: new Date(),
    })

    const dayKey = new Date().toISOString().slice(0, 10)
    expect(await consumeSurpriseBonus(ana.id, missionId, dayKey, 100)).toBe(150)
    // Segunda vez: ya se consumió.
    expect(await consumeSurpriseBonus(ana.id, missionId, dayKey, 100)).toBe(100)
    // Otra misión no lleva bonus.
    expect(await consumeSurpriseBonus(ana.id, 'otra-mision', dayKey, 100)).toBe(100)

    const [row] = await db
      .select()
      .from(daily_surprises)
      .where(and(eq(daily_surprises.student_id, ana.id), eq(daily_surprises.mission_id, missionId)))
    expect(row?.consumed_at).not.toBeNull()
  })

  it('solo el propio alumno puede girar la ruleta', async () => {
    const ana = await signupActor(app, 'student')
    const luis = await signupActor(app, 'student')

    expect((await luis.agent.post(`/api/students/${ana.id}/quests/surprise?tz=${TZ}`)).status).toBe(403)
  })
})

describe('reto semanal', () => {
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

  it('las misiones con nota alta completan el reto semanal de perfectas', async () => {
    const ana = await signupActor(app, 'student')
    for (let i = 0; i < 2; i++) await seedToday(ana, { xp: 100, seconds: 120, scores: 90 })
    await seedToday(ana, { xp: 100, seconds: 120, scores: 70 })

    const view = await ana.agent.get(`/api/students/${ana.id}/quests?tz=${TZ}`)
    const perfectas = view.body.week.quests.find((quest: { id: string }) => quest.id === 'semanal-perfectas')
    expect(perfectas).toMatchObject({ progress: 2, done: false })

    await seedToday(ana, { xp: 100, seconds: 120, scores: 88 })
    const despues = await ana.agent.get(`/api/students/${ana.id}/quests?tz=${TZ}`)
    expect(despues.body.week.quests.find((quest: { id: string }) => quest.id === 'semanal-perfectas')).toMatchObject({
      progress: 3,
      done: true,
    })
  })
})
