/**
 * Medallas del alumno: evaluación de condiciones y entrega.
 *
 * Las condiciones se derivan de datos reales (misiones completadas, XP,
 * vocabulario, racha, compras, pase…) y, al leerse el listado, se otorgan las
 * que falten. Una vez otorgadas quedan guardadas para siempre: si luego se
 * rompe la racha o se repite el pase, la medalla sigue siendo suya.
 */
import { randomUUID } from 'node:crypto'
import { and, eq, gte, isNotNull, or, sql } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import {
  evaluations,
  group_members,
  medals,
  missions,
  narrative_states,
  purchases,
  responses,
  saved_words,
} from '../../db/schema.ts'
import { levelProgress } from '../../lib/xp.ts'
import { MEDALS, type MedalDefinition } from '../../lib/medals.ts'
import { getSeasonXpBySeason } from '../season/service.ts'
import { getStudentProgress } from '../students/service.ts'

const TIER_XP = 400
const MAX_TIER = 20
const PERFECT_SCORE = 95

export interface StudentMedal extends MedalDefinition {
  earned: boolean
  earned_at: string | null
}

/** Evalúa todas las condiciones y devuelve los ids merecidos ahora mismo. */
async function earnedMedalIds(studentId: string): Promise<Set<string>> {
  const levelExpr = sql`extract(hour from ${evaluations.evaluated_at})`

  const [
    completedByLevel,
    totalsByLevel,
    xpRow,
    wordsRow,
    reviewsRow,
    completedRow,
    nocturnalRow,
    morningRow,
    perfectRow,
    groupRow,
    purchasesRow,
    xpBySeason,
    progress,
  ] = await Promise.all([
    db
      .select({ level: missions.cefr_level, done: sql<number>`count(distinct ${narrative_states.mission_id})::int` })
      .from(narrative_states)
      .innerJoin(missions, eq(missions.id, narrative_states.mission_id))
      .where(and(eq(narrative_states.student_id, studentId), eq(narrative_states.state, 'completed')))
      .groupBy(missions.cefr_level),
    db
      .select({ level: missions.cefr_level, total: sql<number>`count(*)::int` })
      .from(missions)
      .groupBy(missions.cefr_level),
    db
      .select({ total: sql<number>`coalesce(sum(${evaluations.xp_awarded}), 0)::int` })
      .from(evaluations)
      .innerJoin(responses, eq(responses.id, evaluations.response_id))
      .where(eq(responses.student_id, studentId)),
    db.select({ total: sql<number>`count(*)::int` }).from(saved_words).where(eq(saved_words.student_id, studentId)),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(saved_words)
      .where(and(eq(saved_words.student_id, studentId), or(isNotNull(saved_words.reviewed_at), gte(saved_words.review_stage, 1)))),
    db
      .select({ total: sql<number>`count(distinct ${narrative_states.mission_id})::int` })
      .from(narrative_states)
      .where(and(eq(narrative_states.student_id, studentId), eq(narrative_states.state, 'completed'))),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(evaluations)
      .innerJoin(responses, eq(responses.id, evaluations.response_id))
      .where(and(eq(responses.student_id, studentId), sql`${levelExpr} < 5`)),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(evaluations)
      .innerJoin(responses, eq(responses.id, evaluations.response_id))
      .where(and(eq(responses.student_id, studentId), sql`${levelExpr} < 7`)),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(evaluations)
      .innerJoin(responses, eq(responses.id, evaluations.response_id))
      .where(and(eq(responses.student_id, studentId), gte(evaluations.comprehensibility_score, PERFECT_SCORE))),
    db.select({ total: sql<number>`count(*)::int` }).from(group_members).where(eq(group_members.student_id, studentId)),
    db.select({ total: sql<number>`count(*)::int` }).from(purchases).where(eq(purchases.student_id, studentId)),
    getSeasonXpBySeason(studentId),
    getStudentProgress(studentId),
  ])

  const earned = new Set<string>()

  // Niveles completados: comparar misiones completadas con el total del nivel.
  const doneByLevel = new Map(completedByLevel.map(row => [row.level, row.done]))
  for (const row of totalsByLevel) {
    if ((doneByLevel.get(row.level) ?? 0) >= row.total) {
      const medalId = `dios-${row.level.toLowerCase()}`
      const alias: Record<string, string> = {
        'dios-a1': 'dios-a1',
        'dios-a2': 'principe-basico',
        'dios-b1': 'senor-intermedio',
        'dios-b2': 'maestro-avanzado',
        'dios-c1': 'leyenda-c1',
      }
      if (alias[medalId]) earned.add(alias[medalId])
    }
  }

  // Nivel de XP.
  const level = levelProgress(xpRow[0]?.total ?? 0).level
  if (level >= 10) earned.add('nivel-10')
  if (level >= 20) earned.add('nivel-20')
  if (level >= 30) earned.add('nivel-30')
  if (level >= 40) earned.add('nivel-40')
  if (level >= 50) earned.add('nivel-50')

  // Misiones.
  const completed = completedRow[0]?.total ?? 0
  if (completed >= 1) earned.add('primera-mision')
  if (completed >= 10) earned.add('misiones-10')
  if (completed >= 50) earned.add('misiones-50')
  if (completed >= 100) earned.add('misiones-100')

  // Racha (la actual; al otorgarse queda guardada aunque se rompa).
  if (progress.streak >= 7) earned.add('racha-7')
  if (progress.streak >= 30) earned.add('racha-30')

  // Vocabulario y repaso.
  const words = wordsRow[0]?.total ?? 0
  if (words >= 50) earned.add('palabras-50')
  if (words >= 150) earned.add('palabras-150')
  if ((reviewsRow[0]?.total ?? 0) >= 25) earned.add('repasos-25')

  // Varias.
  if ((perfectRow[0]?.total ?? 0) >= 5) earned.add('perfectas-5')
  if ((nocturnalRow[0]?.total ?? 0) > 0) earned.add('nocturno')
  if ((morningRow[0]?.total ?? 0) > 0) earned.add('madrugador')
  if ([...xpBySeason.values()].some(xp => xp >= TIER_XP * MAX_TIER)) earned.add('pase-completo')
  if ((purchasesRow[0]?.total ?? 0) >= 5) earned.add('comprador-5')
  if ((groupRow[0]?.total ?? 0) > 0) earned.add('en-equipo')

  return earned
}

/** Otorga las medallas merecidas que aún no estén guardadas. */
async function awardMedals(studentId: string): Promise<void> {
  const earned = await earnedMedalIds(studentId)
  if (earned.size === 0) return

  const existing = await db
    .select({ medal_id: medals.medal_id })
    .from(medals)
    .where(eq(medals.student_id, studentId))
  const have = new Set(existing.map(row => row.medal_id))

  const missing = [...earned].filter(id => !have.has(id))
  if (missing.length === 0) return

  await db
    .insert(medals)
    .values(missing.map(medalId => ({ id: randomUUID(), student_id: studentId, medal_id: medalId, earned_at: new Date() })))
    .onConflictDoNothing({ target: [medals.student_id, medals.medal_id] })
}

/** Catálogo completo con el estado de cada medalla para el alumno. */
export async function getStudentMedals(
  studentId: string,
): Promise<{ medals: StudentMedal[]; earned: number; total: number }> {
  await awardMedals(studentId)

  const rows = await db.select().from(medals).where(eq(medals.student_id, studentId))
  const byId = new Map(rows.map(row => [row.medal_id, row.earned_at]))

  const catalog = MEDALS.map(medal => ({
    ...medal,
    earned: byId.has(medal.id),
    earned_at: byId.get(medal.id)?.toISOString() ?? null,
  }))

  return { medals: catalog, earned: byId.size, total: MEDALS.length }
}
