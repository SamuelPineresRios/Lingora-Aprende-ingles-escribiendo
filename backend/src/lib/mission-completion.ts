import { eq, sql } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { evaluations, responses } from '../db/schema.ts'

/**
 * Estado real de una misión para el alumno:
 * - `challenge`: completada en el Desafío (respuesta completada con XP).
 * - `free`: jugada en práctica libre, pero el Desafío sigue pendiente.
 *
 * La práctica libre guarda evaluaciones con 0 XP; un intento de Desafío
 * incompleto también puede dar XP parcial, así que exigimos status completed.
 */
export interface MissionCompletion {
  challenge: boolean
  free: boolean
}

export async function getMissionCompletions(
  studentId: string,
): Promise<Map<string, MissionCompletion>> {
  const rows = await db
    .select({
      mission_id: responses.mission_id,
      any_completed: sql<boolean>`bool_or(${responses.status} = 'completed')`,
      challenge_completed: sql<boolean>`bool_or(${responses.status} = 'completed' and ${evaluations.xp_awarded} > 0)`,
    })
    .from(responses)
    .leftJoin(evaluations, eq(evaluations.response_id, responses.id))
    .where(eq(responses.student_id, studentId))
    .groupBy(responses.mission_id)

  return new Map(
    rows.map(row => {
      const challenge = Boolean(row.challenge_completed)
      return [row.mission_id, { challenge, free: Boolean(row.any_completed) && !challenge }]
    }),
  )
}
