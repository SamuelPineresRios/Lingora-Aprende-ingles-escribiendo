/**
 * Progreso gamificado del alumno: XP total, nivel, racha y escudos.
 *
 * La zona horaria viaja al backend porque «hoy» decide el XP del día y la
 * racha. El nivel no se guarda: se deriva del XP en el servidor.
 */
import { useEffect, useState } from 'react'
import { readJson } from '@/lib/api'

export interface StudentProgress {
  level: number
  total_xp: number
  level_xp: number
  level_span: number
  xp_to_next: number
  /** Días seguidos con actividad (hoy o ayer como último día). */
  streak: number
  /** Practicó ayer y aún no hoy: la racha se rompe al terminar el día. */
  streak_at_risk: boolean
  /** Hubo actividad pero se dejó pasar el día: un escudo puede salvarla. */
  streak_broken: boolean
  /** Escudos de racha disponibles. */
  streak_shields: number
  missions_completed: number
  writing_seconds: number
  xp_today: number
}

export function useProgress(studentId: string | undefined): {
  progress: StudentProgress | null
  refresh: () => void
} {
  const [progress, setProgress] = useState<StudentProgress | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!studentId) return
    let cancelled = false
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    fetch(`/api/students/${studentId}/xp?tz=${encodeURIComponent(timezone)}`)
      .then(readJson)
      .then(data => {
        if (!cancelled) setProgress(data?.progress ?? null)
      })
      .catch(() => {
        // Sin progreso la interfaz simplemente no pinta la barra.
      })

    return () => {
      cancelled = true
    }
  }, [studentId, tick])

  return { progress, refresh: () => setTick(value => value + 1) }
}
