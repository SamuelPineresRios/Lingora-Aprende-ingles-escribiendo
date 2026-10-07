/**
 * Temporadas y pase de batalla.
 *
 * La temporada 1 arranca en una fecha fija (lunes) y rota sola cada 4 semanas.
 * El XP de la temporada es el XP ganado por misiones dentro de esa ventana;
 * cada 400 XP se sube una casilla (20 por temporada) y cada casilla entrega
 * una recompensa: marcos para el avatar, insignias o monedas.
 *
 * Todo es puro (fechas y catálogo): las consultas viven en el servicio.
 */

/** Lunes de la semana en que arrancó la temporada 1 (UTC). */
export const SEASON_EPOCH = '2026-10-05'

/** Duración de una temporada: 4 semanas exactas. */
export const SEASON_WEEKS = 4
const SEASON_DAYS = SEASON_WEEKS * 7
const DAY_MS = 24 * 60 * 60 * 1000

/** XP por casilla y total de casillas de la temporada. */
export const TIER_XP = 400
export const MAX_TIER = 20

const EPOCH_MS = new Date(`${SEASON_EPOCH}T00:00:00Z`).getTime()

export interface SeasonWindow {
  /** Empieza en 1. */
  number: number
  /** Primer instante de la temporada (UTC). */
  startsAt: Date
  /** Último instante incluido (UTC). */
  endsAt: Date
}

/** Temporada a la que pertenece una fecha (las anteriores al inicio caen en la 1). */
export function seasonFor(date: Date): SeasonWindow {
  const index = Math.max(0, Math.floor((date.getTime() - EPOCH_MS) / (SEASON_DAYS * DAY_MS)))
  const startsAt = new Date(EPOCH_MS + index * SEASON_DAYS * DAY_MS)
  const endsAt = new Date(startsAt.getTime() + SEASON_DAYS * DAY_MS - 1)
  return { number: index + 1, startsAt, endsAt }
}

/** Casillas completas con un XP de temporada (0..20). */
export function tierFromXp(seasonXp: number): number {
  return Math.min(MAX_TIER, Math.max(0, Math.floor(seasonXp / TIER_XP)))
}

export type SeasonReward =
  | { tier: number; kind: 'coins'; label: string; coins: number }
  | { tier: number; kind: 'badge'; label: string; id: string; description: string }
  | { tier: number; kind: 'frame'; label: string; id: string; colors: [string, string] }

/**
 * Las 20 recompensas de la temporada: monedas repartidas por todo el pase,
 * insignias en los hitos y marcos cada cuatro casillas.
 */
export const SEASON_REWARDS: SeasonReward[] = [
  { tier: 1, kind: 'coins', label: '25 monedas', coins: 25 },
  { tier: 2, kind: 'badge', label: 'Primer paso', id: 'primer-paso', description: 'Empezaste el pase de temporada.' },
  { tier: 3, kind: 'coins', label: '40 monedas', coins: 40 },
  { tier: 4, kind: 'frame', label: 'Marco de bronce', id: 'bronce', colors: ['#92400e', '#f59e0b'] },
  { tier: 5, kind: 'coins', label: '50 monedas', coins: 50 },
  { tier: 6, kind: 'badge', label: 'Constante', id: 'constante', description: 'Seis casillas de temporada.' },
  { tier: 7, kind: 'coins', label: '75 monedas', coins: 75 },
  { tier: 8, kind: 'frame', label: 'Marco de plata', id: 'plata', colors: ['#64748b', '#cbd5e1'] },
  { tier: 9, kind: 'coins', label: '100 monedas', coins: 100 },
  { tier: 10, kind: 'badge', label: 'A mitad', id: 'a-mitad', description: 'Media temporada completada.' },
  { tier: 11, kind: 'coins', label: '125 monedas', coins: 125 },
  { tier: 12, kind: 'frame', label: 'Marco de oro', id: 'oro', colors: ['#b45309', '#fbbf24'] },
  { tier: 13, kind: 'coins', label: '150 monedas', coins: 150 },
  { tier: 14, kind: 'badge', label: 'Veterano', id: 'veterano', description: 'Catorce casillas de temporada.' },
  { tier: 15, kind: 'coins', label: '175 monedas', coins: 175 },
  { tier: 16, kind: 'frame', label: 'Marco de diamante', id: 'diamante', colors: ['#0ea5e9', '#a5f3fc'] },
  { tier: 17, kind: 'coins', label: '200 monedas', coins: 200 },
  { tier: 18, kind: 'badge', label: 'Leyenda', id: 'leyenda', description: 'Dieciocho casillas de temporada.' },
  { tier: 19, kind: 'coins', label: '250 monedas', coins: 250 },
  { tier: 20, kind: 'frame', label: 'Marco de campeón', id: 'campeon', colors: ['#7c3aed', '#f472b6'] },
]

/** Monedas que entrega una temporada según el XP alcanzado. */
export function coinsForXp(seasonXp: number): number {
  const tier = tierFromXp(seasonXp)
  return SEASON_REWARDS.filter(
    (reward): reward is Extract<SeasonReward, { kind: 'coins' }> =>
      reward.kind === 'coins' && reward.tier <= tier,
  ).reduce((sum, reward) => sum + reward.coins, 0)
}
