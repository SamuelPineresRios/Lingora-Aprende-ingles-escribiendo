/**
 * Tests de las ligas semanales.
 *
 * Lo importante: que la liga agrupe por XP de la semana en curso (no del
 * histórico), que las zonas dependan del tamaño y que cada alumno reciba solo
 * su bracket.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createApp } from '../src/app.ts'
import { db } from '../src/db/client.ts'
import { evaluations, responses } from '../src/db/schema.ts'
import { LEAGUE_SIZE, leagueZones, zoneAt } from '../src/lib/league.ts'
import { resetDb } from './helpers/db.ts'
import { createMission, signupActor, type Actor } from './helpers/fixtures.ts'

const app = createApp()

/** Respuesta evaluada con XP en una fecha concreta. */
async function seedXp(student: Actor, missionId: string, xp: number, submittedAt: Date): Promise<void> {
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

beforeEach(async () => {
  await resetDb()
})

describe('motor de ligas', () => {
  it('tamaño de liga y zonas', () => {
    expect(LEAGUE_SIZE).toBe(15)
    expect(leagueZones(15)).toEqual({ promote: 5, relegate: 5 })
    expect(leagueZones(12)).toEqual({ promote: 5, relegate: 5 })
    expect(leagueZones(4)).toEqual({ promote: 3, relegate: 0 })

    expect(zoneAt(1, 12)).toBe('promotion')
    expect(zoneAt(5, 12)).toBe('promotion')
    expect(zoneAt(6, 12)).toBe('safe')
    expect(zoneAt(8, 12)).toBe('relegation')
    expect(zoneAt(4, 4)).toBe('safe') // liga pequeña: no hay descensos
  })
})

describe('GET /api/students/:id/league', () => {
  it('arma el bracket por XP de la semana y marca las zonas', async () => {
    const students: Actor[] = []
    const mission = await createMission({ cefr_level: 'B1' })
    for (let i = 0; i < 12; i++) {
      const student = await signupActor(app, 'student')
      await seedXp(student, mission, (i + 1) * 10, new Date())
      students.push(student)
    }
    // Quien consulta es el de XP 60: séptimo en la liga de 12, zona segura.
    const yo = students[5]!

    const res = await yo.agent.get(`/api/students/${yo.id}/league?tz=UTC`)

    expect(res.status).toBe(200)
    expect(res.body.entries).toHaveLength(12)
    expect(res.body.bracket).toEqual({ index: 0, total: 1 })
    expect(res.body.entries[0]).toMatchObject({ position: 1, week_xp: 120, zone: 'promotion' })
    expect(res.body.entries[5]).toMatchObject({ position: 6, week_xp: 70, zone: 'safe' })
    expect(res.body.entries[6]).toMatchObject({ position: 7, student_id: yo.id, week_xp: 60, zone: 'safe' })
    expect(res.body.entries[11]).toMatchObject({ position: 12, week_xp: 10, zone: 'relegation' })
    expect(res.body.my_zone).toBe('safe')
  }, 30_000) // doce altas con bcrypt tardan; el límite por defecto se queda corto

  it('el XP de la semana pasada no cuenta', async () => {
    const ana = await signupActor(app, 'student')
    const luis = await signupActor(app, 'student')
    const mission = await createMission({ cefr_level: 'B1' })

    const haceOchoDias = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    await seedXp(ana, mission, 10, new Date())
    await seedXp(luis, mission, 900, haceOchoDias)

    const res = await ana.agent.get(`/api/students/${ana.id}/league?tz=UTC`)

    expect(res.body.entries.map((entry: { student_id: string }) => entry.student_id)).toEqual([ana.id, luis.id])
    expect(res.body.entries[0]?.week_xp).toBe(10)
    expect(res.body.entries[1]?.week_xp).toBe(0)
  })

  it('solo el propio alumno o su docente ven la liga', async () => {
    const ana = await signupActor(app, 'student')
    const otro = await signupActor(app, 'student')
    const teacher = await signupActor(app, 'teacher')

    expect((await otro.agent.get(`/api/students/${ana.id}/league`)).status).toBe(403)
    expect((await teacher.agent.get(`/api/students/${ana.id}/league`)).status).toBe(200)
  })
})
