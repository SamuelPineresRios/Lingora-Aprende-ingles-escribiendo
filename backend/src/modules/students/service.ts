/**
 * Lógica de dominio de alumnos: grupos del alumno, unirse a un grupo y
 * agregados de escritura (semanal y de sesión).
 */
import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db } from '../../db/client.ts'
import {
  evaluations,
  group_members,
  groups,
  mission_assignments,
  missions,
  responses,
  users,
  weekly_aggregates,
} from '../../db/schema.ts'
import { levelProgress, streakFromDays, type LevelProgress } from '../../lib/xp.ts'
import { HttpError } from '../../utils/http-error.ts'
import { getWeekStart } from '../../utils/week.ts'

/** Grupos del alumno con sus misiones asignadas y el estado de cada una. */
export async function listStudentGroups(studentId: string) {
  const memberships = await db
    .select({ group_id: group_members.group_id })
    .from(group_members)
    .where(eq(group_members.student_id, studentId))

  const groupIds = memberships.map(membership => membership.group_id)
  if (groupIds.length === 0) return { groups: [] }

  const [groupRows, assignments, responseRows, pointsRow] = await Promise.all([
    db.select().from(groups).where(inArray(groups.id, groupIds)),
    db.select().from(mission_assignments).where(inArray(mission_assignments.group_id, groupIds)),
    db
      .select({
        group_id: responses.group_id,
        mission_id: responses.mission_id,
        status: responses.status,
      })
      .from(responses)
      .where(eq(responses.student_id, studentId)),
    // total_points es el mismo para todos los grupos (no depende del grupo):
    // se calcula una sola vez.
    db
      .select({ total: sql<number>`COALESCE(SUM(${evaluations.xp_awarded}), 0)::int` })
      .from(responses)
      .innerJoin(evaluations, eq(evaluations.response_id, responses.id))
      .where(eq(responses.student_id, studentId)),
  ])

  const teacherIds = [...new Set(groupRows.map(group => group.teacher_id))]
  const missionIds = [...new Set(assignments.map(assignment => assignment.mission_id))]

  const [teacherRows, missionRows] = await Promise.all([
    teacherIds.length
      ? db
          .select({ id: users.id, full_name: users.full_name })
          .from(users)
          .where(inArray(users.id, teacherIds))
      : Promise.resolve([]),
    missionIds.length
      ? db.select({ id: missions.id, title: missions.title }).from(missions)
          .where(inArray(missions.id, missionIds))
      : Promise.resolve([]),
  ])

  const teacherById = new Map(teacherRows.map(teacher => [teacher.id, teacher]))
  const missionById = new Map(missionRows.map(mission => [mission.id, mission]))
  const totalPoints = pointsRow[0]?.total ?? 0

  const completedKeys = new Set<string>()
  const inProgressKeys = new Set<string>()
  for (const response of responseRows) {
    if (response.group_id === null) continue
    const key = `${response.group_id}|${response.mission_id}`
    if (response.status === 'completed') completedKeys.add(key)
    else if (response.status === 'in_progress') inProgressKeys.add(key)
  }

  const activeGroups = groupRows.map(group => {
    const teacher = teacherById.get(group.teacher_id)
    const groupAssignments = assignments.filter(assignment => assignment.group_id === group.id)

    const enrichedAssignments = groupAssignments.map(assignment => {
      const mission = missionById.get(assignment.mission_id)
      const key = `${group.id}|${assignment.mission_id}`

      return {
        id: assignment.id,
        content_id: assignment.mission_id,
        type: 'mission',
        title: mission?.title || 'Misión Desconocida',
        due_date: assignment.due_date,
        status: completedKeys.has(key)
          ? 'completed'
          : inProgressKeys.has(key)
            ? 'in_progress'
            : 'pending',
      }
    })

    return {
      id: group.id,
      name: group.name,
      teacher_name: teacher?.full_name ?? 'Comandante Desconocido',
      total_points: totalPoints,
      assignments: enrichedAssignments,
    }
  })

  return { groups: activeGroups }
}

export interface JoinGroupResult {
  group_id: string
  name: string
  already_member?: true
  joined?: true
}

export async function joinGroup(
  studentId: string,
  rawAccessCode: string,
): Promise<JoinGroupResult> {
  const accessCode = rawAccessCode.trim().toUpperCase()

  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.access_code, accessCode))
    .limit(1)
  if (!group) throw new HttpError(404, 'Código inválido')

  const [existing] = await db
    .select({ id: group_members.id })
    .from(group_members)
    .where(
      and(eq(group_members.group_id, group.id), eq(group_members.student_id, studentId)),
    )
    .limit(1)

  if (existing) {
    return { group_id: group.id, name: group.name, already_member: true }
  }

  // `onConflictDoNothing` cubre la carrera de dos uniones simultáneas.
  await db
    .insert(group_members)
    .values({
      id: randomUUID(),
      group_id: group.id,
      student_id: studentId,
      joined_at: new Date(),
    })
    .onConflictDoNothing({
      target: [group_members.group_id, group_members.student_id],
    })

  return { group_id: group.id, name: group.name, joined: true }
}

/** Últimas 4 semanas con los agregados del alumno (0 si no hay datos). */
export async function getWeeklyStats(studentId: string) {
  const weeks = Array.from({ length: 4 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - index * 7)
    return getWeekStart(date)
  })

  const rows = await db
    .select()
    .from(weekly_aggregates)
    .where(
      and(
        eq(weekly_aggregates.student_id, studentId),
        inArray(weekly_aggregates.week_start_date, weeks),
      ),
    )

  const byWeek = new Map(rows.map(row => [row.week_start_date, row]))

  return {
    weekly_stats: weeks.map(week => {
      const aggregate = byWeek.get(week)
      return {
        week_start_date: week,
        missions_completed: aggregate?.missions_completed ?? 0,
        writing_time_seconds: aggregate?.total_writing_time_seconds ?? 0,
        avg_comprehensibility: aggregate?.avg_comprehensibility ?? null,
      }
    }),
  }
}

/** Un día del historial de actividad. */
export interface DailyActivity {
  /** Fecha local del alumno en formato `YYYY-MM-DD`. */
  date: string
  /** Misiones completadas ese día (sin repetir una misma misión). */
  missions: number
  /** Envíos totales, incluidos los que no llegaron al umbral. */
  attempts: number
  /** Segundos de escritura sumados ese día. */
  seconds: number
}

/** Zona horaria IANA válida, o null para usar la de la base de datos. */
function safeTimeZone(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) return null
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return value
  } catch {
    return null
  }
}

/**
 * Actividad diaria del alumno entre dos fechas (ambas incluidas).
 *
 * El día se calcula en la zona horaria que manda el cliente: sin ella, un
 * envío de las 20:00 en Bogotá contaría al día siguiente si la base de datos
 * vive en UTC.
 *
 * `missions` cuenta misiones completadas sin repetir dentro del mismo día
 * (reintentar una misión no infla el historial); `attempts` cuenta todos los
 * envíos, para distinguir "lo intenté tres veces" de "hice tres misiones".
 */
export async function getDailyActivity(
  studentId: string,
  from: string,
  to: string,
  timezone?: unknown,
): Promise<DailyActivity[]> {
  const tz = safeTimeZone(timezone)
  // `::text` no es decorativo: `AT TIME ZONE $n` admite texto o intervalo y
  // Postgres no puede inferir el tipo de un parámetro sin castigar en una
  // consulta preparada (error "could not determine data type").
  const day = tz
    ? sql`((${responses.submitted_at} AT TIME ZONE ${tz}::text)::date)`
    : sql`(${responses.submitted_at}::date)`

  return db
    .select({
      date: sql<string>`to_char(${day}, 'YYYY-MM-DD')`,
      missions: sql<number>`(count(distinct ${responses.mission_id}) filter (where ${responses.status} = 'completed'))::int`,
      attempts: sql<number>`count(*)::int`,
      seconds: sql<number>`coalesce(sum(${responses.time_taken_seconds}), 0)::int`,
    })
    .from(responses)
    .where(
      and(
        eq(responses.student_id, studentId),
        sql`${day} BETWEEN ${from}::date AND ${to}::date`,
      ),
    )
    // Por posición, no repitiendo la expresión: cada incrustación de `day`
    // lleva su propio parámetro ($1, $3...), y Postgres no reconoce que
    // `AT TIME ZONE $1` y `AT TIME ZONE $3` son lo mismo al agrupar.
    .groupBy(sql`1`)
    .orderBy(sql`1`)
}

/** Progreso gamificado del alumno: XP, nivel, racha y totales. */
export interface StudentProgress extends LevelProgress {
  /** Días seguidos con actividad (hoy o ayer como último día). */
  streak: number
  missions_completed: number
  writing_seconds: number
  xp_today: number
}

/** Días hacia atrás que se miran para calcular la racha. */
const STREAK_WINDOW_DAYS = 60

/** `YYYY-MM-DD` de hoy en la zona del alumno (o en la del servidor). */
function todayKeyIn(timeZone: string | null): string {
  if (!timeZone) {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }
  // en-CA formatea justo como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())
}

/** Resta días a una clave `YYYY-MM-DD` (en UTC, para no bailar con el DST). */
function minusDays(key: string, days: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10)
}

/**
 * Progreso del alumno. El XP sale de `evaluations.xp_awarded` y el nivel se
 * deriva de la suma: no hay contadores que puedan desincronizarse.
 */
export async function getStudentProgress(
  studentId: string,
  timezone?: unknown,
): Promise<StudentProgress> {
  const tz = safeTimeZone(timezone)
  const day = tz
    ? sql`((${responses.submitted_at} AT TIME ZONE ${tz}::text)::date)`
    : sql`(${responses.submitted_at}::date)`
  const todayKey = todayKeyIn(tz)

  const [totals] = await db
    .select({
      total_xp: sql<number>`coalesce(sum(${evaluations.xp_awarded}), 0)::int`,
      missions_completed: sql<number>`count(distinct case when ${responses.status} = 'completed' then ${responses.mission_id} end)::int`,
      writing_seconds: sql<number>`coalesce(sum(${responses.time_taken_seconds}), 0)::int`,
      xp_today: sql<number>`coalesce(sum(${evaluations.xp_awarded}) filter (where ${day} = ${todayKey}::date), 0)::int`,
    })
    .from(responses)
    .leftJoin(evaluations, eq(evaluations.response_id, responses.id))
    .where(eq(responses.student_id, studentId))

  // Días con actividad reciente: con ellos se calcula la racha.
  const dayRows = await db
    .select({ day: sql<string>`to_char(${day}, 'YYYY-MM-DD')` })
    .from(responses)
    .where(
      and(
        eq(responses.student_id, studentId),
        sql`${day} >= ${minusDays(todayKey, STREAK_WINDOW_DAYS)}::date`,
      ),
    )
    // Por posición: repetir la expresión con su parámetro rompe el GROUP BY.
    .groupBy(sql`1`)

  const days = new Set(dayRows.map(row => row.day))
  const progress = levelProgress(totals?.total_xp ?? 0)

  return {
    ...progress,
    streak: streakFromDays(days, todayKey, minusDays(todayKey, 1)),
    missions_completed: totals?.missions_completed ?? 0,
    writing_seconds: totals?.writing_seconds ?? 0,
    xp_today: totals?.xp_today ?? 0,
  }
}

/** Métricas del ranking de grupo. */
export type RankingMetric = 'xp' | 'missions' | 'time'

export interface RankingEntry {
  position: number
  student_id: string
  name: string
  xp: number
  missions: number
  seconds: number
}

/**
 * Ranking de un grupo por la métrica pedida.
 *
 * Se rankean las estadísticas **globales** de cada miembro (lo que ha hecho en
 * toda la app), no solo lo hecho dentro del grupo: es lo que pide la frase
 * «quién ha hecho más». Solo lo ve un miembro del grupo o un docente.
 */
/**
 * Ranking global de alumnos: todos los estudiantes registrados, ordenados por
 * XP, misiones o tiempo acumulados en toda la app.
 *
 * Devuelve el top `limit` y, además, la entrada de quien consulta (`you`) con
 * su posición real, aunque quede fuera del top: así la página siempre puede
 * mostrar «tu posición» sin traerse la tabla entera.
 */
export async function getGlobalRanking(
  metric: RankingMetric,
  requesterId: string,
  limit = 100,
): Promise<{ metric: RankingMetric; total: number; entries: RankingEntry[]; you: RankingEntry | null }> {
  const xpExpr = sql<number>`coalesce(sum(${evaluations.xp_awarded}), 0)::int`
  const missionsExpr = sql<number>`count(distinct case when ${responses.status} = 'completed' then ${responses.mission_id} end)::int`
  const secondsExpr = sql<number>`coalesce(sum(${responses.time_taken_seconds}), 0)::int`
  const orderExpr = metric === 'missions' ? missionsExpr : metric === 'time' ? secondsExpr : xpExpr

  // La posición se calcula con una función de ventana sobre las estadísticas
  // agrupadas; los empates comparten posición y se desempatan por XP y nombre.
  const ranking = db
    .select({
      student_id: users.id,
      name: users.full_name,
      // Los campos calculados necesitan alias: la subconsulta de Drizzle los exige.
      xp: sql<number>`coalesce(sum(${evaluations.xp_awarded}), 0)::int`.as('xp'),
      missions: sql<number>`count(distinct case when ${responses.status} = 'completed' then ${responses.mission_id} end)::int`.as('missions'),
      seconds: sql<number>`coalesce(sum(${responses.time_taken_seconds}), 0)::int`.as('seconds'),
      position: sql<number>`rank() over (order by ${orderExpr} desc, ${xpExpr} desc, ${users.full_name} asc)::int`.as('position'),
    })
    .from(users)
    .leftJoin(responses, eq(responses.student_id, users.id))
    .leftJoin(evaluations, eq(evaluations.response_id, responses.id))
    .where(eq(users.role, 'student'))
    .groupBy(users.id, users.full_name)
    .as('ranking')

  const rows = await db.select().from(ranking).orderBy(asc(ranking.position)).limit(limit)
  const [totalRow] = await db.select({ count: sql<number>`count(*)::int` }).from(ranking)

  const toEntry = (row: typeof rows[number]): RankingEntry => ({
    position: row.position,
    student_id: row.student_id,
    name: row.name ?? 'Alumno',
    xp: row.xp,
    missions: row.missions,
    seconds: row.seconds,
  })

  const entries = rows.map(toEntry)

  // Si ya está en el top se reutiliza su fila; si no, se consulta solo la suya
  // (la subconsulta se filtra por id, así no se trae la tabla entera).
  const enTop = entries.find(entry => entry.student_id === requesterId)
  const [mineRow] = enTop
    ? []
    : await db.select().from(ranking).where(eq(ranking.student_id, requesterId)).limit(1)

  return {
    metric,
    total: totalRow?.count ?? 0,
    entries,
    you: enTop ?? (mineRow ? toEntry(mineRow) : null),
  }
}

function generateSuggestion(topStructures: Array<{ structure: string; count: number }>): string {
  if (topStructures.length === 0) {
    return 'Completa tu primera misión para recibir sugerencias personalizadas.'
  }

  const top = topStructures[0]
  if (!top) return 'Completa tu primera misión para recibir sugerencias personalizadas.'

  const map: Record<string, string> = {
    'present simple': `Usaste "${top.structure}" ${top.count} veces. En la próxima misión, combínalo con adverbios de frecuencia: "I usually...", "I often..."`,
    'present perfect': `¡Excelente! Usaste "${top.structure}" ${top.count} veces. Practica usarlo para experiencias: "Have you ever...?"`,
    'past simple': `Usaste "${top.structure}" con confianza. Intenta narrar secuencias: "first... then... finally..."`,
    'modal verbs': `Usaste modales ${top.count} veces. Si usaste "can", prueba "could" para sonar más formal.`,
  }

  const key = Object.keys(map).find(candidate => top.structure.toLowerCase().includes(candidate))
  const suggestion = key ? map[key] : undefined
  return (
    suggestion ??
    `Esta semana usaste "${top.structure}" ${top.count} veces. ¡Sigue practicándolo en la próxima sesión!`
  )
}

/** Resumen de la sesión: tiempo de hoy, agregado semanal y estructuras top. */
/**
 * Estructuras gramaticales más detectadas en las últimas evaluaciones del
 * alumno. Lo usan el resumen de sesión y el perfil de habilidades.
 */
async function topStructuresForStudent(
  studentId: string,
  limit: number,
): Promise<Array<{ structure: string; count: number }>> {
  const recentResponses = await db
    .select({ id: responses.id })
    .from(responses)
    .where(eq(responses.student_id, studentId))
    .orderBy(desc(responses.submitted_at))
    .limit(20)

  const responseIds = recentResponses.map(response => response.id)
  const recentEvaluations = responseIds.length
    ? await db
        .select({ detected_structures: evaluations.detected_structures })
        .from(evaluations)
        .where(inArray(evaluations.response_id, responseIds))
    : []

  const frequency: Record<string, number> = {}
  for (const evaluation of recentEvaluations) {
    for (const structure of evaluation.detected_structures ?? []) {
      frequency[structure] = (frequency[structure] ?? 0) + 1
    }
  }

  return Object.entries(frequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([structure, count]) => ({ structure, count }))
}

export async function getSessionSummary(studentId: string, weekOffset: number) {
  const targetDate = new Date()
  targetDate.setDate(targetDate.getDate() - weekOffset * 7)
  const weekStartDate = getWeekStart(targetDate)

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [weeklyRows, todayRows] = await Promise.all([
    db
      .select()
      .from(weekly_aggregates)
      .where(
        and(
          eq(weekly_aggregates.student_id, studentId),
          eq(weekly_aggregates.week_start_date, weekStartDate),
        ),
      )
      .limit(1),
    db
      .select({
        total: sql<number>`COALESCE(SUM(${responses.time_taken_seconds}), 0)::int`,
      })
      .from(responses)
      .where(
        and(eq(responses.student_id, studentId), gte(responses.submitted_at, todayStart)),
      ),
  ])

  const weekly = weeklyRows[0]
  const topStructures = await topStructuresForStudent(studentId, 3)

  return {
    today_writing_seconds: todayRows[0]?.total ?? 0,
    week_writing_seconds: weekly?.total_writing_time_seconds ?? 0,
    missions_completed_this_week: weekly?.missions_completed ?? 0,
    avg_comprehensibility: weekly?.avg_comprehensibility ?? null,
    top_structures: topStructures,
    actionable_suggestion: generateSuggestion(topStructures),
    week_start_date: weekStartDate,
  }
}

/** Habilidades medidas por la app, en la escala 0-100 del radar del perfil. */
export interface StudentSkills {
  /** Respuestas evaluadas que sustentan las métricas. */
  evaluated_responses: number
  grammar: number | null
  vocabulary: number | null
  comprehension: number | null
  writing: number | null
  speed: number | null
  top_structures: Array<{ structure: string; count: number }>
}

function toScore(value: unknown): number | null {
  // `Number(null)` es 0: sin esta guarda, "sin datos" se convertiría en un 0.
  if (value === null || value === undefined) return null
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? Math.round(numeric) : null
}

/**
 * Perfil de habilidades real del alumno, calculado desde sus evaluaciones.
 *
 * - grammar / vocabulary / comprehension: medias de las tres notas que da el
 *   evaluador en cada respuesta.
 * - writing: media de esas tres notas (calidad global de la escritura).
 * - speed: cuánto tarda frente a la duración prevista de la misión; 100 es
 *   terminarla dentro del tiempo base.
 *
 * La app no tiene actividades de lectura, así que no hay nota de lectura: no
 * se inventa.
 */
export async function getStudentSkills(studentId: string): Promise<StudentSkills> {
  const [row] = await db
    .select({
      evaluated_responses: sql<number>`count(*)::int`,
      grammar: sql<number | null>`avg(${evaluations.grammar_score})::float`,
      vocabulary: sql<number | null>`avg(${evaluations.lexical_richness_score})::float`,
      comprehension: sql<number | null>`avg(${evaluations.comprehensibility_score})::float`,
      writing: sql<number | null>`avg((${evaluations.grammar_score} + ${evaluations.lexical_richness_score} + ${evaluations.comprehensibility_score}) / 3.0)::float`,
      speed: sql<number | null>`avg(
        CASE
          WHEN ${responses.time_taken_seconds} > 0 AND ${missions.base_duration_seconds} > 0
          THEN least(100, 100.0 * ${missions.base_duration_seconds} / ${responses.time_taken_seconds})
        END
      )::float`,
    })
    .from(responses)
    .innerJoin(evaluations, eq(evaluations.response_id, responses.id))
    .innerJoin(missions, eq(missions.id, responses.mission_id))
    .where(eq(responses.student_id, studentId))

  const topStructures = await topStructuresForStudent(studentId, 5)

  return {
    evaluated_responses: row?.evaluated_responses ?? 0,
    grammar: toScore(row?.grammar),
    vocabulary: toScore(row?.vocabulary),
    comprehension: toScore(row?.comprehension),
    writing: toScore(row?.writing),
    speed: toScore(row?.speed),
    top_structures: topStructures,
  }
}
