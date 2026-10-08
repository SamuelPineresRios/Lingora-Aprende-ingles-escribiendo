/**
 * Tests del informe de clase en CSV y de las métricas del panel.
 *
 * Lo importante: que solo lo descargue el docente dueño del grupo, que el CSV
 * traiga una fila por alumno con sus totales y que escape comas y comillas.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createApp } from '../src/app.ts'
import { db } from '../src/db/client.ts'
import { evaluations, responses } from '../src/db/schema.ts'
import { resetDb } from './helpers/db.ts'
import { createGroup, createMission, signupActor, type Actor } from './helpers/fixtures.ts'

const app = createApp()

/** Respuesta evaluada de un alumno. */
async function seedXp(student: Actor, missionId: string, xp: number, seconds: number): Promise<void> {
  const responseId = randomUUID()
  await db.insert(responses).values({
    id: responseId,
    mission_id: missionId,
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

describe('GET /api/teachers/groups/:id/report.csv', () => {
  it('exige docente y que el grupo sea suyo', async () => {
    const teacher = await signupActor(app, 'teacher')
    const otro = await signupActor(app, 'teacher')
    const group = await createGroup(app, teacher)

    // El guard global ya corta a los alumnos antes de llegar aquí.
    const student = await signupActor(app, 'student')
    expect((await student.agent.get(`/api/teachers/groups/${group.id}/report.csv`)).status).toBe(403)
    expect((await otro.agent.get(`/api/teachers/groups/${group.id}/report.csv`)).status).toBe(404)
  })

  it('devuelve el CSV con una fila por alumno, escape y totales', async () => {
    const teacher = await signupActor(app, 'teacher')
    const group = await createGroup(app, teacher, 'Clase 5º B')
    const ana = await signupActor(app, 'student', { full_name: 'Ríos, Ana' })
    const luis = await signupActor(app, 'student', { full_name: 'Luis Gómez' })
    await ana.agent.post('/api/students/join-group').send({ access_code: group.access_code })
    await luis.agent.post('/api/students/join-group').send({ access_code: group.access_code })

    const mission = await createMission({ cefr_level: 'B1' })
    await seedXp(ana, mission, 300, 600)
    // Luis no ha practicado nunca.

    const res = await teacher.agent.get(`/api/teachers/groups/${group.id}/report.csv`)

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toContain('informe-clase-5-b.csv')

    const csv = res.text
    expect(csv.startsWith('\uFEFF')).toBe(true)
    const lines = csv.replace('\uFEFF', '').trim().split('\n')
    expect(lines[0]).toContain('Alumno,Email,Nivel,XP total')
    expect(lines).toHaveLength(3) // cabecera + dos alumnos

    const filaAna = lines.find(line => line.includes('Ríos, Ana'))!
    expect(filaAna).toContain('"Ríos, Ana"') // la coma del nombre va entre comillas
    expect(filaAna).toContain('300')
    expect(filaAna).toContain('10') // 600 s = 10 minutos

    const filaLuis = lines.find(line => line.includes('Luis Gómez'))!
    expect(filaLuis).toContain('Nunca')
  })

  it('el panel trae los totales globales y los días sin practicar', async () => {
    const teacher = await signupActor(app, 'teacher')
    const group = await createGroup(app, teacher)
    const ana = await signupActor(app, 'student')
    await ana.agent.post('/api/students/join-group').send({ access_code: group.access_code })
    const mission = await createMission({ cefr_level: 'B1' })
    await seedXp(ana, mission, 150, 300)

    const res = await teacher.agent.get(`/api/teachers/groups/${group.id}/students`)

    const student = res.body.students[0]
    expect(student.xp_total).toBe(150)
    expect(student.missions_total).toBe(1)
    expect(student.inactive_days).toBe(0)
    expect(student.last_activity_at).not.toBeNull()
  })
})
