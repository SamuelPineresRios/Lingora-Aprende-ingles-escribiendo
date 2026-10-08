/**
 * Tests del ranking global de alumnos.
 *
 * Lo importante: que entren todos los estudiantes registrados (sin grupos),
 * que cada métrica ordene bien, que los docentes queden fuera y que quien
 * consulta reciba su posición aunque no esté en el top.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { createApp } from '../src/app.ts'
import { db } from '../src/db/client.ts'
import { evaluations, responses, student_loadout } from '../src/db/schema.ts'
import { resetDb } from './helpers/db.ts'
import { createMission, signupActor, type Actor } from './helpers/fixtures.ts'

const app = createApp()

/** Respuesta evaluada con XP, misiones y tiempo conocidos. */
async function seedActivity(
  student: Actor,
  missionId: string,
  { xp, seconds, submittedAt, completed = true }: { xp: number; seconds: number; submittedAt: string; completed?: boolean },
): Promise<void> {
  const responseId = randomUUID()
  await db.insert(responses).values({
    id: responseId,
    mission_id: missionId,
    student_id: student.id,
    text_content: 'texto',
    input_mode: 'text',
    transcript: null,
    time_taken_seconds: seconds,
    submitted_at: new Date(submittedAt),
    status: completed ? 'completed' : 'in_progress',
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
    evaluated_at: new Date(submittedAt),
    xp_awarded: xp,
  })
}

beforeEach(async () => {
  await resetDb()
})

describe('GET /api/students/ranking', () => {
  it('exige sesión', async () => {
    const res = await request(app).get('/api/students/ranking')
    expect(res.status).toBe(401)
  })

  it('ordena a todos los alumnos por XP y deja con ceros a quien no ha hecho nada', async () => {
    const ana = await signupActor(app, 'student')
    const luis = await signupActor(app, 'student')
    const sinActividad = await signupActor(app, 'student')
    const mission = await createMission({ cefr_level: 'B1' })
    const otra = await createMission({ cefr_level: 'B1' })

    await seedActivity(ana, mission, { xp: 120, seconds: 300, submittedAt: '2026-03-10T10:00:00Z' })
    await seedActivity(ana, otra, { xp: 80, seconds: 200, submittedAt: '2026-03-11T10:00:00Z' })
    await seedActivity(luis, mission, { xp: 300, seconds: 100, submittedAt: '2026-03-10T10:00:00Z' })

    const res = await ana.agent.get('/api/students/ranking')

    expect(res.status).toBe(200)
    expect(res.body.metric).toBe('xp')
    expect(res.body.total).toBe(3)

    const entries = res.body.entries as Array<{
      student_id: string
      xp: number
      missions: number
      seconds: number
      position: number
    }>
    expect(entries[0]?.student_id).toBe(luis.id)
    expect(entries[0]?.xp).toBe(300)
    expect(entries[1]?.student_id).toBe(ana.id)
    expect(entries[1]?.xp).toBe(200)
    expect(entries[1]?.missions).toBe(2)
    expect(entries[1]?.seconds).toBe(500)
    expect(entries[2]?.student_id).toBe(sinActividad.id)
    expect(entries[2]?.xp).toBe(0)
    expect(entries.map(entry => entry.position)).toEqual([1, 2, 3])

    // Quien consulta sale marcado en `you`, aunque ya esté en el top.
    expect(res.body.you.student_id).toBe(ana.id)
    expect(res.body.you.position).toBe(2)
  })

  it('ordena por misiones y por tiempo cuando se pide; una métrica rara cae en XP', async () => {
    const ana = await signupActor(app, 'student')
    const luis = await signupActor(app, 'student')
    const mission = await createMission({ cefr_level: 'B1' })
    const otra = await createMission({ cefr_level: 'B1' })

    // Ana: más misiones y más tiempo; Luis: más XP con una sola misión.
    await seedActivity(ana, mission, { xp: 60, seconds: 400, submittedAt: '2026-03-10T10:00:00Z' })
    await seedActivity(ana, otra, { xp: 60, seconds: 300, submittedAt: '2026-03-11T10:00:00Z' })
    await seedActivity(luis, mission, { xp: 500, seconds: 50, submittedAt: '2026-03-10T10:00:00Z' })

    const porMisiones = await ana.agent.get('/api/students/ranking?metric=missions')
    expect(porMisiones.body.entries[0]?.student_id).toBe(ana.id)
    expect(porMisiones.body.entries[0]?.missions).toBe(2)

    const porTiempo = await ana.agent.get('/api/students/ranking?metric=time')
    expect(porTiempo.body.entries[0]?.student_id).toBe(ana.id)
    expect(porTiempo.body.entries[0]?.seconds).toBe(700)

    const desconocida = await ana.agent.get('/api/students/ranking?metric=loquesea')
    expect(desconocida.body.metric).toBe('xp')
    expect(desconocida.body.entries[0]?.student_id).toBe(luis.id)
  })

  it('no incluye docentes y comparte posición en los empates', async () => {
    const teacher = await signupActor(app, 'teacher')
    const ana = await signupActor(app, 'student')
    const luis = await signupActor(app, 'student')
    const mission = await createMission({ cefr_level: 'B1' })

    await seedActivity(ana, mission, { xp: 100, seconds: 100, submittedAt: '2026-03-10T10:00:00Z' })
    await seedActivity(luis, mission, { xp: 100, seconds: 100, submittedAt: '2026-03-10T10:00:00Z' })

    const res = await ana.agent.get('/api/students/ranking')

    expect(res.body.total).toBe(2)
    expect(res.body.entries.map((entry: { student_id: string }) => entry.student_id)).not.toContain(teacher.id)
    expect(res.body.entries.map((entry: { position: number }) => entry.position)).toEqual([1, 1])
  })

  it('devuelve «tu posición» aunque quedes fuera del top pedido', async () => {
    const ana = await signupActor(app, 'student')
    const luis = await signupActor(app, 'student')
    const mission = await createMission({ cefr_level: 'B1' })

    await seedActivity(ana, mission, { xp: 50, seconds: 100, submittedAt: '2026-03-10T10:00:00Z' })
    await seedActivity(luis, mission, { xp: 400, seconds: 100, submittedAt: '2026-03-10T10:00:00Z' })

    const res = await ana.agent.get('/api/students/ranking?limit=1')

    expect(res.body.entries).toHaveLength(1)
    expect(res.body.entries[0]?.student_id).toBe(luis.id)
    expect(res.body.you.student_id).toBe(ana.id)
    expect(res.body.you.position).toBe(2)
    expect(res.body.you.xp).toBe(50)
  })
})

describe('cosméticos del ranking', () => {
  it('cada entrada trae el skin base y, equipados, su marco y su título', async () => {
    const ana = await signupActor(app, 'student')
    await db
      .insert(student_loadout)
      .values({ student_id: ana.id, frame_id: 'marco-fuego', title_ids: ['titulo-constante'] })

    const res = await ana.agent.get('/api/students/ranking')

    const [entry] = res.body.entries as Array<{
      avatar: { seed: string }
      frame: { id: string; colors: string[] } | null
      titles: Array<{ id: string; text: string }>
    }>
    expect(entry?.avatar.seed).toBe(ana.id)
    expect(entry?.frame).toEqual({ id: 'marco-fuego', colors: ['#dc2626', '#f59e0b'] })
    expect(entry?.titles).toEqual([{ id: 'titulo-constante', text: 'Constante' }])
  })

  it('sin marco de tienda cae al mejor del pase desbloqueado', async () => {
    const ana = await signupActor(app, 'student')
    const mission = await createMission({ cefr_level: 'B1' })
    // 1600 XP de temporada = casilla 4: marco de bronce.
    await seedActivity(ana, mission, { xp: 1600, seconds: 300, submittedAt: '2026-10-06T10:00:00Z' })

    const res = await ana.agent.get('/api/students/ranking')

    const [entry] = res.body.entries as Array<{ frame: { id: string; colors: string[] } | null; titles: unknown[] }>
    expect(entry?.frame).toEqual({ id: 'bronce', colors: ['#92400e', '#f59e0b'] })
    expect(entry?.titles).toEqual([])
  })

  it('la liga trae los mismos cosméticos', async () => {
    const ana = await signupActor(app, 'student')
    await db.insert(student_loadout).values({ student_id: ana.id, frame_id: 'marco-neon', title_ids: ['titulo-explorador'] })
    const mission = await createMission({ cefr_level: 'B1' })
    await seedActivity(ana, mission, { xp: 120, seconds: 300, submittedAt: '2026-10-06T10:00:00Z' })

    const res = await ana.agent.get(`/api/students/${ana.id}/league?tz=UTC`)

    const [entry] = res.body.entries as Array<{
      avatar: { seed: string }
      frame: { id: string } | null
      titles: Array<{ id: string; text: string }>
    }>
    expect(entry?.avatar.seed).toBe(ana.id)
    expect(entry?.frame?.id).toBe('marco-neon')
    expect(entry?.titles).toEqual([{ id: 'titulo-explorador', text: 'Explorador' }])
  })
})
