import { useCallback, useEffect, useRef, useState } from 'react'
import { CHALLENGE_MISSION_SECONDS } from '@vox/shared'
import { TOTAL_HEARTS } from '../constants'
import type { MissionMode } from '../types'

/**
 * Estado del Desafío: corazones, reloj total (3:00) y fallo.
 * El reloj corre mientras la conversación está activa; se detiene al enviar
 * el informe y se reanuda si el envío falla.
 */
export interface MissionChallenge {
  mode: MissionMode
  hearts: number
  failed: boolean
  timeUp: boolean
  start: (mode: MissionMode) => void
  stop: () => void
  resume: () => void
  reset: () => void
  loseHeart: () => void
  dismissFailed: () => void
}

export function useChallenge(): MissionChallenge {
  const [mode, setMode] = useState<MissionMode>('free')
  const [hearts, setHearts] = useState(TOTAL_HEARTS)
  const [failed, setFailed] = useState(false)
  const [timeUp, setTimeUp] = useState(false)
  const [seconds, setSeconds] = useState(CHALLENGE_MISSION_SECONDS)
  const [running, setRunning] = useState(false)
  const deadline = useRef<number | null>(null)

  const start = useCallback((nextMode: MissionMode) => {
    setMode(nextMode)
    setHearts(TOTAL_HEARTS)
    setFailed(false)
    setTimeUp(false)
    setSeconds(CHALLENGE_MISSION_SECONDS)

    if (nextMode === 'evaluation') {
      deadline.current = Date.now() + CHALLENGE_MISSION_SECONDS * 1000
      setRunning(true)
    } else {
      deadline.current = null
      setRunning(false)
    }
  }, [])

  const stop = useCallback(() => setRunning(false), [])

  const resume = useCallback(() => {
    if (mode !== 'evaluation' || !deadline.current || timeUp) return
    setRunning(true)
  }, [mode, timeUp])

  const reset = useCallback(() => {
    setRunning(false)
    deadline.current = null
    setHearts(TOTAL_HEARTS)
    setFailed(false)
    setTimeUp(false)
    setSeconds(CHALLENGE_MISSION_SECONDS)
  }, [])

  const loseHeart = useCallback(() => {
    if (mode !== 'evaluation') return

    setHearts(current => {
      const remaining = Math.max(current - 1, 0)
      if (remaining === 0) setFailed(true)
      return remaining
    })
  }, [mode])

  const dismissFailed = useCallback(() => setFailed(false), [])

  useEffect(() => {
    if (!running || mode !== 'evaluation' || !deadline.current) return

    const update = () => {
      const remaining = Math.max(0, Math.ceil((deadline.current! - Date.now()) / 1000))
      setSeconds(remaining)
    }

    update()
    const interval = setInterval(update, 500)
    return () => clearInterval(interval)
  }, [running, mode])

  useEffect(() => {
    if (!running || mode !== 'evaluation' || seconds > 0) return

    setRunning(false)
    setTimeUp(true)
    setFailed(true)
  }, [running, mode, seconds])

  return { mode, hearts, failed, timeUp, start, stop, resume, reset, loseHeart, dismissFailed }
}
