/**
 * Retos del alumno: los diarios, el cofre con premio sorpresa y la ruleta.
 *
 * El progreso se deriva de las respuestas del periodo; reclamar inserta el
 * registro en `quest_claims` y paga el premio en una transacción (el índice
 * único evita dobles reclamos por carrera). La sorpresa del día es una misión
 * al azar con bonus de XP: se sortea una vez al día y se consume al enviarla.
 */
import { randomUUID } from 'node:crypto'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import {
  coin_ledger,
  daily_surprises,
  evaluations,
  missions,
  quest_claims,
  responses,
  saved_words,
  streak_shields,
  users,
} from '../../db/schema.ts'
import { HttpError } from '../../utils/http-error.ts'
import { mondayKeyOf, safeTimeZone, todayKeyIn, weekKeyOf } from '../../lib/date-keys.ts'
import {
  CHEST_REWARDS,
  DAILY_CHEST,
  DAILY_QUESTS,
  SURPRISE_XP_PERCENT,
  WEEKLY_QUESTS,
  questProgress,
  rollChestReward,
  type ChestReward,
  type QuestActivity,
  type QuestDefinition,
} from '../../lib/quests.ts'
import { getCoinBalance } from '../season/service.ts'

export interface QuestState extends QuestDefinition {
  progress: number
  done: boolean
  claimed: boolean
}

/** Sorpresa del día: misión al azar y bonus de XP si se completa hoy. */
export interface SurpriseView {
  mission: { id: string; title: string }
  xp_percent: number
  consumed: boolean
}

export interface QuestsView {
  balance: number
  day: {
    key: string
    quests: QuestState[]
    chest: { ready: boolean; claimed: boolean }
    surprise: SurpriseView | null
  }
  week: { key: string; quests: QuestState[] }
}

/** Actividad del alumno desde una fecha (incluida), en su zona horaria. */
async function activitySince(studentId: string, tz: string | null, fromKey: string): Promise<QuestActivity> {
  const day = tz
    ? sql`((${responses.submitted_at} AT TIME ZONE ${tz}::text)::date)`
    : sql`(${responses.submitted_at}::date)`

  const wordsDay = tz
    ? sql`((${saved_words.created_at} AT TIME ZONE ${tz}::text)::date)`
    : sql`(${saved_words.created_at}::date)`

  const [[row], [wordsRow]] = await Promise.all([
    db
      .select({
        missions: sql<number>`(count(distinct ${responses.mission_id}) filter (where ${responses.status} = 'completed'))::int`,
        xp: sql<number>`coalesce(sum(${evaluations.xp_awarded}), 0)::int`,
        seconds: sql<number>`coalesce(sum(${responses.time_taken_seconds}), 0)::int`,
        perfect: sql<number>`(count(distinct ${responses.mission_id}) filter (where ${responses.status} = 'completed' and (${evaluations.comprehensibility_score} + ${evaluations.grammar_score} + ${evaluations.lexical_richness_score}) / 3 >= 85))::int`,
      })
      .from(responses)
      .leftJoin(evaluations, eq(evaluations.response_id, responses.id))
      .where(and(eq(responses.student_id, studentId), sql`${day} >= ${fromKey}::date`)),
    db
      .select({ words: sql<number>`count(*)::int` })
      .from(saved_words)
      .where(and(eq(saved_words.student_id, studentId), sql`${wordsDay} >= ${fromKey}::date`)),
  ])

  return {
    missions: row?.missions ?? 0,
    xp: row?.xp ?? 0,
    seconds: row?.seconds ?? 0,
    perfect: row?.perfect ?? 0,
    words: wordsRow?.words ?? 0,
  }
}

/** Convierte las definiciones en el estado que ve la interfaz. */
function withState(definitions: QuestDefinition[], activity: QuestActivity, claimed: Set<string>): QuestState[] {
  return definitions.map(quest => {
    const progress = questProgress(quest, activity)
    return { ...quest, progress, done: progress >= quest.target, claimed: claimed.has(quest.id) }
  })
}

/** La sorpresa de hoy (si se giró), con el título de su misión. */
async function todaysSurprise(studentId: string, dayKey: string): Promise<SurpriseView | null> {
  const [row] = await db
    .select({
      mission_id: daily_surprises.mission_id,
      title: missions.title,
      xp_percent: daily_surprises.xp_percent,
      consumed_at: daily_surprises.consumed_at,
    })
    .from(daily_surprises)
    .innerJoin(missions, eq(missions.id, daily_surprises.mission_id))
    .where(and(eq(daily_surprises.student_id, studentId), eq(daily_surprises.day_key, dayKey)))
    .limit(1)

  if (!row) return null
  return {
    mission: { id: row.mission_id, title: row.title },
    xp_percent: row.xp_percent,
    consumed: row.consumed_at !== null,
  }
}

/** Vista de retos: progreso de hoy y de la semana, cofre, sorpresa y saldo. */
export async function getStudentQuests(studentId: string, timezone?: unknown): Promise<QuestsView> {
  const tz = safeTimeZone(timezone)
  const todayKey = todayKeyIn(tz)
  const weekKey = weekKeyOf(todayKey)
  const weekStartKey = mondayKeyOf(todayKey)

  const [dayActivity, weekActivity, claims, balance, surprise] = await Promise.all([
    activitySince(studentId, tz, todayKey),
    activitySince(studentId, tz, weekStartKey),
    db
      .select({ quest_id: quest_claims.quest_id, period_key: quest_claims.period_key })
      .from(quest_claims)
      .where(and(eq(quest_claims.student_id, studentId), inArray(quest_claims.period_key, [todayKey, weekKey]))),
    getCoinBalance(studentId),
    todaysSurprise(studentId, todayKey),
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
        ready: dayQuests.every(quest => quest.claimed),
        claimed: dayClaimed.has(DAILY_CHEST.id),
      },
      surprise,
    },
    week: { key: weekKey, quests: withState(WEEKLY_QUESTS, weekActivity, weekClaimed) },
  }
}

/**
 * Reclama un reto o el cofre.
 *
 * El cofre sortea su premio al abrirlo: monedas (lo común) o un escudo de
 * racha (raro). Devuelve la vista y, si tocó cofre, el premio para celebrarlo.
 */
export async function claimQuest(
  studentId: string,
  rawQuestId: unknown,
  timezone?: unknown,
): Promise<QuestsView & { reward: ChestReward | null }> {
  const questId = typeof rawQuestId === 'string' ? rawQuestId : ''
  const view = await getStudentQuests(studentId, timezone)
  const todayKey = view.day.key

  const isChest = questId === DAILY_CHEST.id
  const state = isChest
    ? null
    : (view.day.quests.find(quest => quest.id === questId) ?? view.week.quests.find(quest => quest.id === questId))

  if (!isChest && !state) throw new HttpError(404, 'Reto no encontrado')

  if (isChest) {
    if (!view.day.chest.ready) throw new HttpError(400, 'Completa todos los retos del día para abrir el cofre')
    if (view.day.chest.claimed) throw new HttpError(400, 'El cofre de hoy ya está abierto')
  } else if (state!.claimed) {
    throw new HttpError(400, 'Ese reto ya está reclamado')
  } else if (!state!.done) {
    throw new HttpError(400, 'Todavía no completaste ese reto')
  }

  const reward = isChest ? rollChestReward() : null
  const coins = reward ? (reward.coins ?? 0) : state!.coins
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
      if (coins > 0) {
        await tx.insert(coin_ledger).values({
          id: randomUUID(),
          student_id: studentId,
          amount: coins,
          reason: 'quest',
          ref: questId,
          created_at: new Date(),
        })
      }
      if (reward?.kind === 'shield') {
        await tx.insert(streak_shields).values({
          id: randomUUID(),
          student_id: studentId,
          used_for_day: null,
          created_at: new Date(),
        })
      }
    })
  } catch (err) {
    // Carrera con otro reclamo idéntico: el índice único lo corta.
    if ((err as { code?: string }).code === '23505') throw new HttpError(400, 'Ese reto ya está reclamado')
    throw err
  }

  return { ...(await getStudentQuests(studentId, timezone)), reward }
}

/**
 * Gira la ruleta del día: misión al azar del nivel del alumno con bonus de XP.
 *
 * Girar dos veces el mismo día devuelve la misma misión (una fila por día).
 */
export async function spinSurprise(
  studentId: string,
  timezone?: unknown,
): Promise<QuestsView & { surprise: SurpriseView }> {
  const tz = safeTimeZone(timezone)
  const todayKey = todayKeyIn(tz)

  let surprise = await todaysSurprise(studentId, todayKey)
  if (!surprise) {
    const [student] = await db
      .select({ cefr_level: users.cefr_level })
      .from(users)
      .where(eq(users.id, studentId))
      .limit(1)
    const level = student?.cefr_level ?? 'A1'

    const [mission] = await db
      .select({ id: missions.id })
      .from(missions)
      .where(eq(missions.cefr_level, level))
      .orderBy(sql`random()`)
      .limit(1)
    if (!mission) throw new HttpError(400, 'No hay misiones disponibles para tu nivel')

    // Carrera de dos pestañas: el índice único deja una sola fila por día.
    await db
      .insert(daily_surprises)
      .values({
        id: randomUUID(),
        student_id: studentId,
        day_key: todayKey,
        mission_id: mission.id,
        xp_percent: SURPRISE_XP_PERCENT,
        created_at: new Date(),
      })
      .onConflictDoNothing()

    surprise = await todaysSurprise(studentId, todayKey)
  }

  if (!surprise) throw new HttpError(500, 'No se pudo preparar la sorpresa')
  return { ...(await getStudentQuests(studentId, timezone)), surprise }
}

/**
 * Aplica el bonus de la sorpresa al XP de una misión completada.
 *
 * Devuelve el XP final (con bonus si esta misión era la sorpresa de hoy y no
 * se había consumido). El `UPDATE` condicional garantiza que solo se use una
 * vez aunque dos envíos lleguen a la vez.
 */
export async function consumeSurpriseBonus(
  studentId: string,
  missionId: string,
  dayKey: string,
  baseXp: number,
): Promise<number> {
  const [surprise] = await db
    .select({ id: daily_surprises.id, xp_percent: daily_surprises.xp_percent })
    .from(daily_surprises)
    .where(
      and(
        eq(daily_surprises.student_id, studentId),
        eq(daily_surprises.mission_id, missionId),
        eq(daily_surprises.day_key, dayKey),
        isNull(daily_surprises.consumed_at),
      ),
    )
    .limit(1)

  if (!surprise) return baseXp

  const [claimed] = await db
    .update(daily_surprises)
    .set({ consumed_at: new Date() })
    .where(and(eq(daily_surprises.id, surprise.id), isNull(daily_surprises.consumed_at)))
    .returning({ id: daily_surprises.id })

  if (!claimed) return baseXp
  return Math.round((baseXp * surprise.xp_percent) / 100)
}

/** Catálogo de premios del cofre, para pintarlo en la interfaz. */
export function chestRewards(): ChestReward[] {
  return CHEST_REWARDS
}
