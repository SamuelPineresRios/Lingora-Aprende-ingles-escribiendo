/**
 * Temporadas y pase de batalla (acceso a datos).
 *
 * La matemática pura vive en `lib/season.ts`; aquí se consulta el XP por
 * temporada del alumno y se arma el progreso. El módulo de tienda reutiliza
 * `getSeasonCoins` para calcular el saldo sin duplicar la consulta.
 */
import { eq } from 'drizzle-orm'
import { eq as equals, sql } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { coin_ledger, evaluations, responses } from '../../db/schema.ts'
import {
  MAX_TIER,
  SEASON_REWARDS,
  TIER_XP,
  coinsForXp,
  seasonFor,
  tierFromXp,
  type SeasonReward,
} from '../../lib/season.ts'

export interface SeasonProgress {
  season: { number: number; starts_at: string; ends_at: string; days_left: number }
  /** XP ganado dentro de la temporada actual. */
  xp: number
  /** Casillas completadas (0..20). */
  tier: number
  /** XP dentro de la casilla actual. */
  tier_xp: number
  tier_span: number
  /** XP que falta para la siguiente casilla (0 si el pase está completo). */
  xp_to_next_tier: number
  /** Monedas acumuladas por todas las temporadas (incluida la actual). */
  coins: number
  rewards: Array<SeasonReward & { unlocked: boolean }>
}

/** XP del alumno agrupado por temporada (una misión cuenta donde se envió). */
export async function getSeasonXpBySeason(studentId: string): Promise<Map<number, number>> {
  const rows = await db
    .select({ xp: evaluations.xp_awarded, submittedAt: responses.submitted_at })
    .from(evaluations)
    .innerJoin(responses, eq(responses.id, evaluations.response_id))
    .where(eq(responses.student_id, studentId))

  const xpBySeason = new Map<number, number>()
  for (const row of rows) {
    const season = seasonFor(row.submittedAt)
    xpBySeason.set(season.number, (xpBySeason.get(season.number) ?? 0) + (row.xp ?? 0))
  }
  return xpBySeason
}

/** Monedas que el pase ha dado al alumno en todas sus temporadas. */
export async function getSeasonCoins(studentId: string): Promise<number> {
  const xpBySeason = await getSeasonXpBySeason(studentId)
  let coins = 0
  for (const xp of xpBySeason.values()) coins += coinsForXp(xp)
  return coins
}

/**
 * Saldo disponible: monedas del pase más el libro de movimientos (retos,
 * compras y escudos). Es el número que ven el pase y la tienda.
 */
export async function getCoinBalance(studentId: string): Promise<number> {
  const [seasonCoins, ledger] = await Promise.all([
    getSeasonCoins(studentId),
    db
      .select({ total: sql<number>`coalesce(sum(${coin_ledger.amount}), 0)::int` })
      .from(coin_ledger)
      .where(equals(coin_ledger.student_id, studentId)),
  ])
  return seasonCoins + (ledger[0]?.total ?? 0)
}

/** Pase de batalla del alumno: temporada actual, casilla y recompensas. */
export async function getSeasonProgress(studentId: string): Promise<SeasonProgress> {
  const now = new Date()
  const current = seasonFor(now)
  const xpBySeason = await getSeasonXpBySeason(studentId)

  const seasonXp = xpBySeason.get(current.number) ?? 0
  const tier = tierFromXp(seasonXp)

  return {
    season: {
      number: current.number,
      starts_at: current.startsAt.toISOString(),
      ends_at: current.endsAt.toISOString(),
      days_left: Math.max(0, Math.ceil((current.endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))),
    },
    xp: seasonXp,
    tier,
    tier_xp: seasonXp - tier * TIER_XP,
    tier_span: TIER_XP,
    xp_to_next_tier: tier >= MAX_TIER ? 0 : (tier + 1) * TIER_XP - seasonXp,
    coins: await getCoinBalance(studentId),
    rewards: SEASON_REWARDS.map(reward => ({ ...reward, unlocked: reward.tier <= tier })),
  }
}
