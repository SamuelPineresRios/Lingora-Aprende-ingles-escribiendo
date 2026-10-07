/**
 * Reglas de experiencia (XP).
 *
 * Funciones puras para poder probarlas sin base de datos. El XP se guarda en
 * `evaluations.xp_awarded` (el campo existía y estaba siempre en null) y el
 * nivel se deriva de la suma: no se denormaliza nada.
 *
 * La idea: premiar hacer misiones y hacerlas bien, nunca enviar mensajes ni
 * pasar tiempo. Repetir una misión da práctica, no recompensa completa.
 */
import type { CefrLevel } from '@vox/shared'

/** XP base por completar una misión, antes de multiplicadores. */
export const BASE_XP = 50

/** Una misión C1 vale más que una A1: 50/60/75/90/110 XP por nivel. */
const CEFR_MULTIPLIER: Record<CefrLevel, number> = {
  A1: 1,
  A2: 1.2,
  B1: 1.5,
  B2: 1.8,
  C1: 2.2,
}

/** Intentarlo sin completar también suma: el tiempo del alumno no es gratis. */
const PARTIAL_XP_RATIO = 0.4
/** Repetir una misión ya completada es práctica, no una segunda recompensa. */
const REPEAT_XP_RATIO = 0.25
/** Bonus por completar esa misión la primera vez (premia contenido nuevo). */
const FIRST_TIME_BONUS = 30

export interface MissionXpInput {
  cefrLevel: CefrLevel
  /** Si el evaluador dio la misión por superada. */
  completed: boolean
  /** Si es la primera vez que este alumno completa esta misión. */
  firstCompletion: boolean
  /** Notas de la evaluación (0-100); la media por encima de 50 suma extra. */
  scores: number[]
}

/** XP que otorga un envío, redondeado. */
export function missionXp({ cefrLevel, completed, firstCompletion, scores }: MissionXpInput): number {
  const base = BASE_XP * (CEFR_MULTIPLIER[cefrLevel] ?? 1)

  // Un envío que no completa la misión deja una parte de la base.
  if (!completed) return Math.round(base * PARTIAL_XP_RATIO)
  // Repetir una misión completada no vuelve a pagar el bonus completo.
  if (!firstCompletion) return Math.round(base * REPEAT_XP_RATIO)

  const average = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0
  const performance = Math.max(0, (average - 50) / 2)
  return Math.round(base + performance + FIRST_TIME_BONUS)
}

/**
 * Multiplicador de XP por racha: premia aparecer varios días seguidos, con
 * tope para que no se dispare.
 */
export function streakMultiplier(streak: number): number {
  if (streak >= 30) return 1.5
  if (streak >= 14) return 1.3
  if (streak >= 7) return 1.2
  if (streak >= 3) return 1.1
  return 1
}

/** XP acumulado necesario para estar en `level` (nivel 1 = 0). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  return (100 * (level - 1) * level) / 2
}

/** Nivel que corresponde a un total de XP (curva: 100, 300, 600, 1000...). */
export function levelFromXp(totalXp: number): number {
  let level = 1
  while (xpForLevel(level + 1) <= totalXp) level += 1
  return level
}

export interface LevelProgress {
  level: number
  total_xp: number
  /** XP logrado dentro del nivel actual. */
  level_xp: number
  /** XP que abarca el nivel actual. */
  level_span: number
  /** Cuánto falta para subir. */
  xp_to_next: number
}

export function levelProgress(totalXp: number): LevelProgress {
  const total = Math.max(0, Math.round(totalXp))
  const level = levelFromXp(total)
  const floor = xpForLevel(level)
  const next = xpForLevel(level + 1)
  return {
    level,
    total_xp: total,
    level_xp: total - floor,
    level_span: next - floor,
    xp_to_next: next - total,
  }
}

/**
 * Días seguidos con actividad, contando hacia atrás desde hoy.
 *
 * Si hoy aún no hay envíos pero ayer sí, la racha sigue viva (se cuenta desde
 * ayer): perderla exige dejar pasar un día entero.
 */
export function streakFromDays(
  days: Set<string>,
  todayKey: string,
  yesterdayKey: string,
  /** Días salvados con un escudo: cuentan como actividad. */
  covered: Set<string> = new Set(),
): number {
  const activo = (key: string) => days.has(key) || covered.has(key)
  const cursor = activo(todayKey) ? todayKey : activo(yesterdayKey) ? yesterdayKey : null
  if (!cursor) return 0

  let streak = 0
  // Se trabaja en UTC a propósito: las claves ya vienen fechadas en la zona
  // del alumno y aquí sólo se resta un día.
  let date = new Date(`${cursor}T00:00:00Z`)
  while (activo(dayKeyUtc(date))) {
    streak += 1
    date = new Date(date.getTime() - 24 * 60 * 60 * 1000)
  }
  return streak
}

/** `YYYY-MM-DD` de una fecha UTC (la usada por `streakFromDays`). */
function dayKeyUtc(date: Date): string {
  return date.toISOString().slice(0, 10)
}
