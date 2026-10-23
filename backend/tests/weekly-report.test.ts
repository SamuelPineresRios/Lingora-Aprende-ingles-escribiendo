/**
 * Tests del informe semanal.
 *
 * Lo importante: que la semana sea la del alumno (lunes a domingo), que los
 * deltas comparen contra la semana pasada, que la evolución traiga seis
 * semanas, que las palabras y estructuras salgan de sus datos y que solo el
 * propio alumno o sus docentes puedan verlo.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createApp } from '../src/app.ts'
import { db } from '../src/db/client.ts'
import { evaluations, grammar_errors, responses, saved_words, word_lookups } from '../src/db/schema.ts'
import { minusDays, mondayKeyOf, todayKeyIn } from '../src/lib/date-keys.ts'
import { resetDb } from './helpers/db.ts'
import { createMission, signupActor, type Actor } from './helpers/fixtures.ts'

const app = createApp()
const TZ = 'UTC'

/** Respuesta evaluada con fecha y notas dadas. */
async function seedResponse(
  student: Actor,
  missionId: string,
  { xp, scores, seconds = 120, when, structures = [] }: {
    xp: number
    scores: number
    seconds?: number
    when: Date
    structures?: string[]
  },
): Promise<void> {
  const responseId = randomUUID()
  await db.insert(responses).values({
    id: responseId,
    mission_id: missionId,
    student_id: student.id,
    text_content: 'texto',
    status: 'completed',
    time_taken_seconds: seconds,
    submitted_at: when,
  })
  await db.insert(evaluations).values({
    id: randomUUID(),
    response_id: responseId,
    comprehensibility_score: scores,
    grammar_score: scores,
    lexical_richness_score: scores,
    judgment: 'ADVANCE',
    feedback_text: 'ok',
    detected_structures: structures,
    evaluated_at: when,
    xp_awarded: xp,
  })
}

/** Palabra guardada con fecha y estado de repaso dados. */
async function seedWord(student: Actor, { when, mastered }: { when: Date; mastered: boolean }): Promise<void> {
  const lookupId = randomUUID()
  await db.insert(word_lookups).values({
    id: lookupId,
    word: `palabra-${randomUUID().slice(0, 8)}`,
    translation: 'palabra',
    part_of_speech: 'noun',
    examples: [],
  })
  await db.insert(saved_words).values({
    id: randomUUID(),
    student_id: student.id,
    word_lookup_id: lookupId,
    created_at: when,
    review_due_at: mastered ? null : when,
  })
}

beforeEach(async () => {
  await resetDb()
})

describe('GET /api/students/:id/weekly-report', () => {
  it('sin actividad devuelve la semana en curso y seis semanas a cero', async () => {
    const ana = await signupActor(app, 'student')

    const res = await ana.agent.get(`/api/students/${ana.id}/weekly-report?tz=${TZ}`)

    expect(res.status).toBe(200)
    const weekStart = mondayKeyOf(todayKeyIn(TZ))
    expect(res.body.week.starts_at).toBe(weekStart)
    expect(res.body.week.ends_at).toBe(minusDays(weekStart, -6))
    expect(res.body.current).toMatchObject({ missions: 0, xp: 0, seconds: 0, grammar: null })
    expect(res.body.deltas).toMatchObject({ missions: 0, xp: 0, grammar: null })
    expect(res.body.evolution).toHaveLength(6)
    expect(res.body.evolution.every((week: { missions: number }) => week.missions === 0)).toBe(true)
  })

  it('compara la semana en curso con la anterior y trae la evolución', async () => {
    const ana = await signupActor(app, 'student')
    const ahora = new Date()
    const semanaPasada = new Date(ahora.getTime() - 7 * 86_400_000)
    const m1 = await createMission({ id: 'm-wr-1', cefr_level: 'B1' })
    const m2 = await createMission({ id: 'm-wr-2', cefr_level: 'B1' })

    await seedResponse(ana, m1, { xp: 60, scores: 80, when: ahora })
    await seedResponse(ana, m2, { xp: 40, scores: 90, when: ahora })
    await seedResponse(ana, m1, { xp: 30, scores: 70, when: semanaPasada })

    const res = await ana.agent.get(`/api/students/${ana.id}/weekly-report?tz=${TZ}`)

    expect(res.body.current.missions).toBe(2)
    expect(res.body.current.xp).toBe(100)
    expect(Math.round(res.body.current.grammar)).toBe(85)
    expect(res.body.previous.missions).toBe(1)
    expect(res.body.previous.xp).toBe(30)
    expect(res.body.deltas).toMatchObject({ missions: 1, xp: 70, grammar: 15 })

    const ultimas = res.body.evolution.slice(-2)
    expect(ultimas[0].missions).toBe(1)
    expect(ultimas[1].missions).toBe(2)
    expect(ultimas[1].xp).toBe(100)
  })

  it('cuenta las palabras guardadas esta semana y las dominadas totales', async () => {
    const ana = await signupActor(app, 'student')
    const ahora = new Date()
    const haceDosSemanas = new Date(ahora.getTime() - 14 * 86_400_000)

    await seedWord(ana, { when: ahora, mastered: false })
    await seedWord(ana, { when: ahora, mastered: true })
    await seedWord(ana, { when: haceDosSemanas, mastered: true })

    const res = await ana.agent.get(`/api/students/${ana.id}/weekly-report?tz=${TZ}`)

    expect(res.body.words.saved_this_week).toBe(2)
    expect(res.body.words.mastered_total).toBe(2)
  })

  it('lista las estructuras más practicadas', async () => {
    const ana = await signupActor(app, 'student')
    const m1 = await createMission({ id: 'm-wr-3', cefr_level: 'B1' })

    await seedResponse(ana, m1, { xp: 50, scores: 85, when: new Date(), structures: ['present simple', 'articles'] })
    await seedResponse(ana, m1, { xp: 50, scores: 85, when: new Date(), structures: ['present simple'] })

    const res = await ana.agent.get(`/api/students/${ana.id}/weekly-report?tz=${TZ}`)

    expect(res.body.top_structures[0]).toEqual({ structure: 'present simple', count: 2 })
  })

  it('respeta permisos: solo el alumno o sus docentes', async () => {
    const ana = await signupActor(app, 'student')
    const luis = await signupActor(app, 'student')
    const teacher = await signupActor(app, 'teacher')

    expect((await luis.agent.get(`/api/students/${ana.id}/weekly-report?tz=${TZ}`)).status).toBe(403)
    expect((await teacher.agent.get(`/api/students/${ana.id}/weekly-report?tz=${TZ}`)).status).toBe(200)
  })
})

describe('reglas a mejorar del informe', () => {
  it('cuenta los errores de la semana y sus tipos más repetidos', async () => {
    const ana = await signupActor(app, 'student')
    const ahora = new Date()
    const semanaPasada = new Date(ahora.getTime() - 7 * 86_400_000)

    await db.insert(grammar_errors).values([
      { id: randomUUID(), student_id: ana.id, error_type: 'third_person_s', created_at: ahora },
      { id: randomUUID(), student_id: ana.id, error_type: 'third_person_s', created_at: ahora },
      { id: randomUUID(), student_id: ana.id, error_type: 'article', created_at: ahora },
      { id: randomUUID(), student_id: ana.id, error_type: 'word_order', created_at: semanaPasada },
    ])

    const res = await ana.agent.get(`/api/students/${ana.id}/weekly-report?tz=${TZ}`)

    expect(res.body.errors).toMatchObject({ this_week: 3, previous_week: 1, delta: 2 })
    expect(res.body.errors.top[0]).toEqual({ type: 'third_person_s', label: 'la -s de tercera persona', count: 2 })
  })
})
