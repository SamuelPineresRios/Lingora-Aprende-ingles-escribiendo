/**
 * Puntos débiles: registro de errores del chat y sesión de drills.
 *
 * El chat llama a `recordGrammarError` cuando el turno trae un tipo de error
 * válido; el alumno pide su informe con `getWeaknessReport`, que devuelve las
 * categorías más repetidas y una sesión de práctica armada con el banco.
 */
import { randomUUID } from 'node:crypto'
import { desc, eq, sql } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { grammar_errors } from '../../db/schema.ts'
import { ERROR_TYPE_BY_ID, buildDrillSession, errorTypeLabel, type DrillExercise } from '../../lib/drills.ts'

export interface WeaknessReport {
  total_errors: number
  top: Array<{ type: string; label: string; count: number }>
  session: DrillExercise[]
}

/** Guarda un error de la conversación (solo tipos conocidos). */
export async function recordGrammarError(
  studentId: string,
  missionId: string | null,
  errorType: string,
): Promise<void> {
  if (!ERROR_TYPE_BY_ID.has(errorType)) return

  await db.insert(grammar_errors).values({
    id: randomUUID(),
    student_id: studentId,
    mission_id: missionId,
    error_type: errorType,
    created_at: new Date(),
  })
}

/** Informe de puntos débiles: conteos por tipo y sesión de práctica. */
export async function getWeaknessReport(studentId: string): Promise<WeaknessReport> {
  const [rows, totalRow] = await Promise.all([
    db
      .select({ error_type: grammar_errors.error_type, count: sql<number>`count(*)::int` })
      .from(grammar_errors)
      .where(eq(grammar_errors.student_id, studentId))
      .groupBy(grammar_errors.error_type)
      .orderBy(desc(sql`count(*)`), grammar_errors.error_type)
      .limit(4),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(grammar_errors)
      .where(eq(grammar_errors.student_id, studentId)),
  ])

  const top = rows.map(row => ({
    type: row.error_type,
    label: errorTypeLabel(row.error_type),
    count: row.count,
  }))

  return {
    total_errors: totalRow[0]?.total ?? 0,
    top,
    session: buildDrillSession(top.map(item => item.type)),
  }
}
