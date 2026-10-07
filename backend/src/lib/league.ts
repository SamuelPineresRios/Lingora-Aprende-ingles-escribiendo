/**
 * Ligas semanales.
 *
 * Los alumnos se agrupan en ligas de 15 por el XP de la semana en curso; los
 * primeros suben, los últimos bajan. Con clases pequeñas no hay descensos y
 * se premia a menos gente, para que la liga no sea una derrota garantizada.
 */
export const LEAGUE_SIZE = 15

export interface LeagueZones {
  /** Cuántos ascienden. */
  promote: number
  /** Cuántos descienden (0 si la liga es pequeña). */
  relegate: number
}

export function leagueZones(size: number): LeagueZones {
  if (size < 10) return { promote: Math.min(3, size), relegate: 0 }
  return { promote: 5, relegate: 5 }
}

export type LeagueZone = 'promotion' | 'safe' | 'relegation'

/** Zona de una posición (1-based) dentro de la liga. */
export function zoneAt(position: number, size: number): LeagueZone {
  const { promote, relegate } = leagueZones(size)
  if (position <= promote) return 'promotion'
  if (relegate > 0 && position > size - relegate) return 'relegation'
  return 'safe'
}
