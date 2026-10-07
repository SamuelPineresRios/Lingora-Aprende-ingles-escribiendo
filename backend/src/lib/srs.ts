/**
 * Repaso espaciado del vocabulario guardado.
 *
 * Escalera clásica de 1, 3, 7 y 21 días: acertar sube un escalón, fallar
 * vuelve al principio con una falta más y, al superar el último, la palabra
 * queda dominada y deja de aparecer en «Repaso de hoy».
 */
export const SRS_STEPS_DAYS = [1, 3, 7, 21] as const

export interface ReviewSchedule {
  /** Escalones superados (0..4). */
  stage: number
  /** Días hasta el próximo repaso; null si quedó dominada. */
  nextInDays: number | null
  mastered: boolean
}

/** Programa el siguiente repaso según el resultado. */
export function nextSchedule(stage: number, correct: boolean): ReviewSchedule {
  if (!correct) return { stage: 0, nextInDays: SRS_STEPS_DAYS[0]!, mastered: false }

  const nextStage = Math.max(0, stage) + 1
  if (nextStage >= SRS_STEPS_DAYS.length) return { stage: nextStage, nextInDays: null, mastered: true }
  return { stage: nextStage, nextInDays: SRS_STEPS_DAYS[nextStage]!, mastered: false }
}
