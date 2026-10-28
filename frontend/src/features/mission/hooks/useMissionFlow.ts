import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { MissionChallenge } from './useChallenge'
import type { MissionConversation } from './useMissionConversation'
import type { MissionMode, MissionPhase } from '../types'

interface MissionFlowParams {
  challenge: MissionChallenge
  conversation: MissionConversation
  clearGuestLimit: () => void
}

export interface MissionFlow {
  phase: MissionPhase
  startTime: number | null
  start: (mode: MissionMode) => void
  toVocabulary: () => void
  toPreparation: () => void
  repeatIntroduction: () => void
  retryChallenge: () => void
}

export function useMissionFlow({
  challenge,
  conversation,
  clearGuestLimit,
}: MissionFlowParams): MissionFlow {
  const [phase, setPhase] = useState<MissionPhase>('introduction')
  const [startTime, setStartTime] = useState<number | null>(null)
  const [searchParams] = useSearchParams()
  const autoChallenge = useRef(false)

  const start = useCallback(
    (mode: MissionMode) => {
      setPhase('active')
      setStartTime(Date.now())
      clearGuestLimit()
      conversation.resetRun()
      challenge.start(mode)
      void conversation.open(mode)
    },
    [challenge, conversation, clearGuestLimit],
  )

  useEffect(() => {
    if (searchParams.get('desafio') !== '1' || autoChallenge.current) return
    autoChallenge.current = true
    start('evaluation')
  }, [searchParams, start])

  const retryChallenge = useCallback(() => {
    setPhase('preparation')
    challenge.reset()
    conversation.resetProgress()
  }, [challenge, conversation])

  return {
    phase,
    startTime,
    start,
    toVocabulary: () => setPhase('vocabulary'),
    toPreparation: () => setPhase('preparation'),
    repeatIntroduction: () => setPhase('introduction'),
    retryChallenge,
  }
}
