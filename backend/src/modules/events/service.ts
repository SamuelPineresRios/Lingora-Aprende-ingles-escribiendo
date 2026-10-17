/**
 * Evento de fin de semana: estado para la interfaz y efectos al completarlo.
 *
 * `weekendEventState` pinta el banner (activo o cuenta atrás) y
 * `applyWeekendEventBonus` se llama desde el envío de la misión: si la escena
 * del evento se completó en sábado o domingo, dobla el XP y entrega el marco
 * exclusivo (una sola vez; la tabla de compras es la dueña de la propiedad).
 */
import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { missions, purchases, users } from '../../db/schema.ts'
import { minusDays, mondayKeyOf } from '../../lib/date-keys.ts'
import { WEEKEND_EVENT, eventMissionFor, isWeekendKey } from '../../lib/weekend-event.ts'

export interface WeekendEventView {
  active: boolean
  /** Sábado y domingo del fin de semana en curso (o del próximo). */
  starts_at: string
  ends_at: string
  xp_percent: number
  mission: { id: string; title: string } | null
  frame: { id: string; label: string; owned: boolean }
}

/** Sábado y domingo de la semana del día dado. */
function weekendOf(dayKey: string): { saturday: string; sunday: string } {
  const weekStart = mondayKeyOf(dayKey)
  return {
    saturday: minusDays(weekStart, -5),
    sunday: minusDays(weekStart, -6),
  }
}

/** Entrega el marco del evento si aún no es suyo (idempotente). */
async function grantEventFrame(studentId: string): Promise<void> {
  await db
    .insert(purchases)
    .values({
      id: randomUUID(),
      student_id: studentId,
      item_id: WEEKEND_EVENT.frame_id,
      created_at: new Date(),
    })
    .onConflictDoNothing()
}

/**
 * Estado del evento para el alumno en una clave de día concreta.
 *
 * Fuera del fin de semana devuelve el del próximo sábado (`active: false`),
 * para que la interfaz pueda enseñar la cuenta atrás.
 */
export async function weekendEventState(studentId: string, dayKey: string): Promise<WeekendEventView> {
  const [student] = await db
    .select({ cefr_level: users.cefr_level })
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1)

  const missionId = eventMissionFor(student?.cefr_level)
  // De lunes a viernes, el sábado de esta semana es el próximo; en sábado o
  // domingo, es el fin de semana en curso.
  const weekend = weekendOf(dayKey)

  const [mission, ownedFrame] = await Promise.all([
    missionId
      ? db.select({ id: missions.id, title: missions.title }).from(missions).where(eq(missions.id, missionId)).limit(1)
      : Promise.resolve([]),
    db
      .select({ id: purchases.id })
      .from(purchases)
      .where(and(eq(purchases.student_id, studentId), eq(purchases.item_id, WEEKEND_EVENT.frame_id)))
      .limit(1),
  ])

  return {
    active: isWeekendKey(dayKey) && Boolean(mission[0]),
    starts_at: weekend.saturday,
    ends_at: weekend.sunday,
    xp_percent: WEEKEND_EVENT.xp_percent,
    mission: mission[0] ? { id: mission[0].id, title: mission[0].title } : null,
    frame: {
      id: WEEKEND_EVENT.frame_id,
      label: WEEKEND_EVENT.frame_label,
      owned: ownedFrame.length > 0,
    },
  }
}

/**
 * Aplica el bonus del evento al XP de una misión completada.
 *
 * Solo actúa en fin de semana y si la misión es la escena del evento del
 * nivel: dobla el XP y entrega el marco exclusivo (una vez).
 */
export async function applyWeekendEventBonus(
  studentId: string,
  missionId: string,
  cefrLevel: string | null,
  dayKey: string,
  xp: number,
): Promise<number> {
  if (!isWeekendKey(dayKey)) return xp
  if (eventMissionFor(cefrLevel) !== missionId) return xp

  await grantEventFrame(studentId)
  return Math.round((xp * WEEKEND_EVENT.xp_percent) / 100)
}
