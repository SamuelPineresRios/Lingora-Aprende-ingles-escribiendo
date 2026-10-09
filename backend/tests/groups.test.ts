/**
 * Tests de integración de grupos: creación por el profesor, unión del alumno,
 * asignación de misiones y paneles.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.ts'
import { resetDb } from './helpers/db.ts'
import { createGroup, createMission, signupActor } from './helpers/fixtures.ts'

const app = createApp()

beforeEach(async () => {
  await resetDb()
})

describe('POST /api/teachers/groups/create', () => {
  it('responde 403 a un alumno (ruta exclusiva de profesor)', async () => {
    const student = await signupActor(app, 'student')

    const res = await student.agent
      .post('/api/teachers/groups/create')
      .send({ name: 'Grupo', parental_consent_confirmed: true })

    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: 'Forbidden' })
  })

  it('exige nombre y consentimiento', async () => {
    const teacher = await signupActor(app, 'teacher')

    const sinNombre = await teacher.agent
      .post('/api/teachers/groups/create')
      .send({ parental_consent_confirmed: true })
    const sinConsentimiento = await teacher.agent
      .post('/api/teachers/groups/create')
      .send({ name: 'Grupo' })

    expect(sinNombre.status).toBe(400)
    expect(sinNombre.body).toEqual({ error: 'name required' })
    expect(sinConsentimiento.status).toBe(400)
    expect(sinConsentimiento.body).toEqual({ error: 'Consentimiento requerido' })
  })

  it('crea el grupo con código de acceso y devuelve la fila', async () => {
    const teacher = await signupActor(app, 'teacher')

    const res = await teacher.agent
      .post('/api/teachers/groups/create')
      .send({ name: '  4º B  ', institution_name: 'Colegio Lingora', parental_consent_confirmed: true })

    expect(res.status).toBe(201)
    expect(res.body.name).toBe('4º B')
    expect(res.body.teacher_id).toBe(teacher.id)
    expect(res.body.access_code).toMatch(/^[A-Z2-9]{7}$/)
    expect(res.body.parental_consent_confirmed).toBe(true)
  })
})

describe('GET /api/teachers/groups', () => {
  it('sólo devuelve los grupos del profesor autenticado', async () => {
    const teacherA = await signupActor(app, 'teacher')
    const teacherB = await signupActor(app, 'teacher')
    await createGroup(app, teacherA, 'Grupo A')
    await createGroup(app, teacherB, 'Grupo B')

    const res = await teacherA.agent.get('/api/teachers/groups')

    expect(res.status).toBe(200)
    expect(res.body.groups).toHaveLength(1)
    expect(res.body.groups[0].name).toBe('Grupo A')
  })
})

describe('GET /api/teachers/groups/:id', () => {
  it('responde 404 si el grupo es de otro profesor', async () => {
    const teacherA = await signupActor(app, 'teacher')
    const teacherB = await signupActor(app, 'teacher')
    const group = await createGroup(app, teacherA)

    const res = await teacherB.agent.get(`/api/teachers/groups/${group.id}`)

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Not found' })
  })
})

describe('POST /api/students/join-group', () => {
  it('responde 400 sin access_code', async () => {
    const student = await signupActor(app, 'student')

    const res = await student.agent.post('/api/students/join-group').send({})

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'access_code required' })
  })

  it('responde 404 con código inválido', async () => {
    const student = await signupActor(app, 'student')

    const res = await student.agent
      .post('/api/students/join-group')
      .send({ access_code: 'ZZZZZZZ' })

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Código inválido' })
  })

  it('une al alumno y es idempotente (acepta minúsculas y espacios)', async () => {
    const teacher = await signupActor(app, 'teacher')
    const student = await signupActor(app, 'student')
    const group = await createGroup(app, teacher)

    const first = await student.agent
      .post('/api/students/join-group')
      .send({ access_code: `  ${group.access_code.toLowerCase()}  ` })
    const second = await student.agent
      .post('/api/students/join-group')
      .send({ access_code: group.access_code })

    expect(first.status).toBe(201)
    expect(first.body).toEqual({ group_id: group.id, name: group.name, joined: true })
    expect(second.status).toBe(200)
    expect(second.body).toEqual({ group_id: group.id, name: group.name, already_member: true })
  })
})

describe('GET /api/students/groups', () => {
  it('devuelve los grupos del alumno con el estado de cada asignación', async () => {
    const teacher = await signupActor(app, 'teacher')
    const student = await signupActor(app, 'student', { cefr_level: 'A1' })
    const group = await createGroup(app, teacher)
    const missionId = await createMission({ id: 'mission-1', cefr_level: 'A1' })

    await student.agent.post('/api/students/join-group').send({ access_code: group.access_code })
    await teacher.agent
      .post(`/api/teachers/groups/${group.id}/assign-mission`)
      .send({ mission_id: missionId })

    const before = await student.agent.get('/api/students/groups')
    expect(before.status).toBe(200)
    expect(before.body.groups).toHaveLength(1)
    expect(before.body.groups[0].teacher_name).toBe('Docente Prueba')
    expect(before.body.groups[0].assignments[0]).toMatchObject({
      content_id: 'mission-1',
      title: 'Presentarse en una entrevista',
      status: 'pending',
    })

    // Completa la misión enviando la respuesta (el respaldo de 65 puntos
    // supera el umbral de A1) y el grupo debe reflejarlo.
    await student.agent
      .post(`/api/missions/${missionId}/submit`)
      .send({ response_text: 'My name is Ana and I am from Peru.', group_id: group.id })

    const after = await student.agent.get('/api/students/groups')
    expect(after.body.groups[0].assignments[0].status).toBe('completed')
  })
})

describe('POST /api/teachers/groups/:id/assign-mission', () => {
  it('valida la misión y el cuerpo', async () => {
    const teacher = await signupActor(app, 'teacher')
    const group = await createGroup(app, teacher)

    const sinMission = await teacher.agent
      .post(`/api/teachers/groups/${group.id}/assign-mission`)
      .send({})
    const misionInexistente = await teacher.agent
      .post(`/api/teachers/groups/${group.id}/assign-mission`)
      .send({ mission_id: 'no-existe' })

    expect(sinMission.status).toBe(400)
    expect(sinMission.body).toEqual({ error: 'mission_id required' })
    expect(misionInexistente.status).toBe(404)
    expect(misionInexistente.body).toEqual({ error: 'Mission not found' })
  })

  it('responde 403 si el grupo es de otro profesor', async () => {
    const teacherA = await signupActor(app, 'teacher')
    const teacherB = await signupActor(app, 'teacher')
    const group = await createGroup(app, teacherA)
    const missionId = await createMission()

    const res = await teacherB.agent
      .post(`/api/teachers/groups/${group.id}/assign-mission`)
      .send({ mission_id: missionId })

    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: 'Forbidden' })
  })

  it('crea la asignación y la lista junto a la misión', async () => {
    const teacher = await signupActor(app, 'teacher')
    const group = await createGroup(app, teacher)
    const missionId = await createMission()

    const created = await teacher.agent
      .post(`/api/teachers/groups/${group.id}/assign-mission`)
      .send({ mission_id: missionId, due_date: '2026-10-15' })

    expect(created.status).toBe(201)
    expect(created.body.due_date).toBe('2026-10-15')

    const listed = await teacher.agent.get(`/api/teachers/groups/${group.id}/assign-mission`)
    expect(listed.body.assignments).toHaveLength(1)
    expect(listed.body.assignments[0].mission.id).toBe(missionId)
  })

  it('ignora una due_date con formato inválido en lugar de romper el INSERT', async () => {
    const teacher = await signupActor(app, 'teacher')
    const group = await createGroup(app, teacher)
    const missionId = await createMission()

    const res = await teacher.agent
      .post(`/api/teachers/groups/${group.id}/assign-mission`)
      .send({ mission_id: missionId, due_date: 'mañana' })

    expect(res.status).toBe(201)
    expect(res.body.due_date).toBeNull()
  })
})

describe('GET /api/teachers/groups/:id/students', () => {
  it('devuelve el panel del grupo con el progreso de cada alumno', async () => {
    const teacher = await signupActor(app, 'teacher')
    const student = await signupActor(app, 'student', { cefr_level: 'A1' })
    const group = await createGroup(app, teacher)
    const missionId = await createMission({ id: 'mission-1', cefr_level: 'A1' })

    await student.agent.post('/api/students/join-group').send({ access_code: group.access_code })
    await teacher.agent
      .post(`/api/teachers/groups/${group.id}/assign-mission`)
      .send({ mission_id: missionId })
    await student.agent
      .post(`/api/missions/${missionId}/submit`)
      .send({ response_text: 'My name is Ana and I am from Peru.', group_id: group.id, time_taken_seconds: 25 })

    const res = await teacher.agent.get(`/api/teachers/groups/${group.id}/students`)

    expect(res.status).toBe(200)
    expect(res.body.total_missions).toBe(1)
    expect(res.body.students).toHaveLength(1)
    // El panel del profesor sólo cuenta como completada una evaluación con
    // judgment ADVANCE; el respaldo (PAUSE, 65) queda en in_progress. Es el
    // comportamiento original (ver deuda conocida en README).
    expect(res.body.students[0]).toMatchObject({
      student_id: student.id,
      missions_completed: 0,
      total_missions: 1,
      writing_time_seconds: 25,
      avg_comprehensibility: 65,
    })
    expect(res.body.students[0].assignments[0]).toMatchObject({
      content_id: 'mission-1',
      status: 'in_progress',
      judged: 'PAUSE',
    })
  })
})

describe('GET /api/teachers/students/:id/profile', () => {
  it('responde 403 si el alumno no pertenece a ninguno de sus grupos', async () => {
    const teacher = await signupActor(app, 'teacher')
    const student = await signupActor(app, 'student')

    const res = await teacher.agent.get(`/api/teachers/students/${student.id}/profile`)

    expect(res.status).toBe(403)
  })

  it('devuelve el perfil con respuestas recientes y misiones completadas', async () => {
    const teacher = await signupActor(app, 'teacher')
    const student = await signupActor(app, 'student', { cefr_level: 'A1' })
    const group = await createGroup(app, teacher)
    const missionId = await createMission({ id: 'mission-1', cefr_level: 'A1' })

    await student.agent.post('/api/students/join-group').send({ access_code: group.access_code })
    await student.agent
      .post(`/api/missions/${missionId}/submit`)
      .send({ response_text: 'My name is Ana and I am from Peru.', group_id: group.id })

    const res = await teacher.agent.get(`/api/teachers/students/${student.id}/profile`)

    expect(res.status).toBe(200)
    expect(res.body.full_name).toBe('Alumno Prueba')
    expect(res.body.cefr_level).toBe('A1')
    expect(res.body.recent_responses).toHaveLength(1)
    expect(res.body.recent_responses[0].mission_id).toBe('mission-1')
    // El respaldo es PAUSE, así que no cuenta como misión completada.
    expect(res.body.missions_completed).toBe(0)
  })
})
