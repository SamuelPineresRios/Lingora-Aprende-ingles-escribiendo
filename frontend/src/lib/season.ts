/**
 * Tipos y ayudas del pase de temporada en el frontend.
 *
 * El catálogo de recompensas viene del backend; aquí solo se traduce a iconos
 * y se elige lo que está activo (el mejor marco desbloqueado, por ejemplo).
 */
import { Award, Crown, Flame, Footprints, ShieldCheck, Star, type LucideIcon } from 'lucide-react'

export type SeasonReward =
  | { tier: number; kind: 'coins'; label: string; coins: number; unlocked: boolean }
  | { tier: number; kind: 'badge'; label: string; id: string; description: string; unlocked: boolean }
  | { tier: number; kind: 'frame'; label: string; id: string; colors: [string, string]; unlocked: boolean }

export interface SeasonProgress {
  season: { number: number; starts_at: string; ends_at: string; days_left: number }
  xp: number
  tier: number
  tier_xp: number
  tier_span: number
  xp_to_next_tier: number
  coins: number
  rewards: SeasonReward[]
}

/** Icono de cada insignia; si el id es nuevo, una genérica. */
export const BADGE_ICONS: Record<string, LucideIcon> = {
  'primer-paso': Footprints,
  constante: Flame,
  'a-mitad': Star,
  veterano: ShieldCheck,
  leyenda: Crown,
}

export function badgeIcon(id: string): LucideIcon {
  return BADGE_ICONS[id] ?? Award
}

/** Marco activo: el mejor (más alto) que el alumno tenga desbloqueado. */
export function activeFrame(progress: SeasonProgress | null) {
  if (!progress) return null
  const frames = progress.rewards.filter(reward => reward.kind === 'frame' && reward.unlocked)
  return (frames.at(-1) ?? null) as Extract<SeasonReward, { kind: 'frame' }> | null
}

/** Insignias desbloqueadas, en orden de casilla. */
export function unlockedBadges(progress: SeasonProgress | null) {
  if (!progress) return []
  return progress.rewards.filter(
    (reward): reward is Extract<SeasonReward, { kind: 'badge' }> => reward.kind === 'badge' && reward.unlocked,
  )
}

/** Fechas legibles de la temporada: "5 oct – 1 nov". */
export function seasonRange(progress: SeasonProgress): string {
  const format = (iso: string) =>
    new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(new Date(iso))
  return `${format(progress.season.starts_at)} – ${format(progress.season.ends_at)}`
}
