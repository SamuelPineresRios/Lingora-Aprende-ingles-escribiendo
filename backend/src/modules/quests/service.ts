/**
 * Retos del alumno: los tres diarios, el cofre y el reto semanal.
 *
 * El progreso se deriva de las respuestas del periodo; reclamar inserta el
 * registro en `quest_claims` y paga monedas en el libro, todo en una
 * transacción (el índice único evita dobles reclamos por carrera).
 */
import { randomUUID } from 'node:crypto'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { coin_ledger, evaluations, quest_claims, responses } from '../../db/schema.ts'
import { HttpError } from '../../utils/http-error.ts'
import { mondayKeyOf, safeTimeZone, todayKeyIn, weekKeyOf } from '../../lib/date-keys.ts'
import {
  DAILY_CHEST,
  DAILY_QUESTS,
  WEEKLY_QUESTS,
  questProgress,
  type QuestActivity,
  type QuestDefinition,
} from '../../lib/quests.ts'
import { getCoinBalance } from '../season/service.ts'

export interface QuestState extends QuestDefinition {
  progress: number
  done: boolean
  claimed: boolean
}

export interface QuestsView {
  balance: number
  day: { key: string; quests: QuestState[]; chest: { coins: number; ready: boolean; claimed: boolean } }
  week: { key: string; quests: QuestState[] }
}

/** Actividad del alumno desde una fecha (incluida), en su zona horaria. */
async function activitySince(studentId: string, tz: string | null, fromKey: string): Promise<QuestActivity> {
  const day = tz
    ? sql`((${responses.submitted_at} AT TIME ZONE ${tz}::text)::date)`
    : sql`(${responses.submitted_at}::date)`

  const [row] = await db
    .select({
      missions: sql<number>`(count(distinct ${responses.mission_id}) filter (where ${responses.status} = 'completed'))::int`,
      xp: sql<number>`coalesce(sum(${evaluations.xp_awarded}), 0)::int`,
      seconds: sql<number>`coalesce(sum(${responses.time_taken_seconds}), 0)::int`,
    })
    .from(responses)
    .leftJoin(evaluations, eq(evaluations.response_id, responses.id))
    .where(and(eq(responses.student_id, studentId), sql`${day} >= ${fromKey}::date`))

  return row ?? { missions: 0, xp: 0, seconds: 0 }
}

/** Convierte las definiciones en el estado que ve la interfaz. */
function withState(definitions: QuestDefinition[], activity: QuestActivity, claimed: Set<string>): QuestState[] {
  return definitions.map(quest => {
    const progress = questProgress(quest, activity)
    return { ...quest, progress, done: progress >= quest.target, claimed: claimed.has(quest.id) }
  })
}

/** Vista de retos: progreso de hoy y de la semana, cofre y saldo. */
export async function getStudentQuests(studentId: string, timezone?: unknown): Promise<QuestsView> {
  const tz = safeTimeZone(timezone)
  const todayKey = todayKeyIn(tz)
  const weekKey = weekKeyOf(todayKey)
  const weekStartKey = mondayKeyOf(todayKey)

  const [dayActivity, weekActivity, claims, balance] = await Promise.all([
    activitySince(studentId, tz, todayKey),
    activitySince(studentId, tz, weekStartKey),
    db
      .select({ quest_id: quest_claims.quest_id, period_key: quest_claims.period_key })
      .from(quest_claims)
      .where(and(eq(quest_claims.student_id, studentId), inArray(quest_claims.period_key, [todayKey, weekKey]))),
    getCoinBalance(studentId),
  ])

  const dayClaimed = new Set(claims.filter(row => row.period_key === todayKey).map(row => row.quest_id))
  const weekClaimed = new Set(claims.filter(row => row.period_key === weekKey).map(row => row.quest_id))
  const dayQuests = withState(DAILY_QUESTS, dayActivity, dayClaimed)

  return {
    balance,
    day: {
      key: todayKey,
      quests: dayQuests,
      chest: {
        coins: DAILY_CHEST.coins,
        ready: dayQuests.every(quest => quest.claimed),
        claimed: dayClaimed.has(DAILY_CHEST.id),
      },
    },
    week: { key: weekKey, quests: withState(WEEKLY_QUESTS, weekActivity, weekClaimed) },
  }
}

/** Reclama un reto (o el cofre) y devuelve la vista actualizada. */
export async function claimQuest(
  studentId: string,
  rawQuestId: unknown,
  timezone?: unknown,
): Promise<QuestsView> {
  const questId = typeof rawQuestId === 'string' ? rawQuestId : ''
  const view = await getStudentQuests(studentId, timezone)
  const todayKey = view.day.key

  const isChest = questId === DAILY_CHEST.id
  const state = isChest
    ? null
    : (view.day.quests.find(quest => quest.id === questId) ?? view.week.quests.find(quest => quest.id === questId))

  if (!isChest && !state) throw new HttpError(404, 'Reto no encontrado')

  if (isChest) {
    if (!view.day.chest.ready) throw new HttpError(400, 'Completa los tres retos del día para abrir el cofre')
    if (view.day.chest.claimed) throw new HttpError(400, 'El cofre de hoy ya está abierto')
  } else if (state!.claimed) {
    throw new HttpError(400, 'Ese reto ya está reclamado')
  } else if (!state!.done) {
    throw new HttpError(400, 'Todavía no completaste ese reto')
  }

  const coins = isChest ? DAILY_CHEST.coins : state!.coins
  const periodKey = isChest || state!.period === 'day' ? todayKey : view.week.key

  try {
    await db.transaction(async tx => {
      await tx.insert(quest_claims).values({
        id: randomUUID(),
        student_id: studentId,
        quest_id: questId,
        period_key: periodKey,
        coins,
        created_at: new Date(),
      })
      await tx.insert(coin_ledger).values({
        id: randomUUID(),
        student_id: studentId,
        amount: coins,
        reason: 'quest',
        ref: questId,
        created_at: new Date(),
      })
    })
  } catch (err) {
    // Carrera con otro reclamo idéntico: el índice único lo corta.
    if ((err as { code?: string }).code === '23505') throw new HttpError(400, 'Ese reto ya está reclamado')
    throw err
  }

  return getStudentQuests(studentId, timezone)
}
