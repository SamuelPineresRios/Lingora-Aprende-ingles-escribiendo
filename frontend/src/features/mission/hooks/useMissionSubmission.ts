import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { markMissionCompleted, submitMissionReport } from '../api'
import type { MissionChallenge } from './useChallenge'
import type { MissionConversation } from './useMissionConversation'
import type { Mission } from '../types'

interface MissionSubmissionParams {
  mission: Mission
  studentId: string
  groupId?: string
  startTime: number | null
  conversation: MissionConversation
  challenge: MissionChallenge
  flagGuestLimit: (data: unknown) => boolean
  onSubmitted: () => void
}

export function useMissionSubmission({
  mission,
  studentId,
  groupId,
  startTime,
  conversation,
  challenge,
  flagGuestLimit,
  onSubmitted,
}: MissionSubmissionParams) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  const submit = async () => {
    if (isSubmitting) return

    const studentTurns = conversation.messages
      .filter(message => message.role === 'user')
      .map(message => message.content)

    if (studentTurns.length === 0) {
      alert('Envía al menos una frase antes de enviar el reporte.')
      return
    }

    const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : null
    setIsSubmitting(true)
    challenge.stop()
    let submitted = false

    try {
      const { ok, data } = await submitMissionReport({
        missionId: mission.id,
        studentId,
        groupId,
        responseText: studentTurns.join('\n\n'),
        timeTakenSeconds: timeTaken,
        mode: challenge.mode,
      })

      if (!ok) {
        console.error('Submission error', data)
        if (flagGuestLimit(data)) return

        alert('Submission failed: ' + (data?.error || 'Unknown error'))
        return
      }

      submitted = true
      onSubmitted()

      try {
        await markMissionCompleted(mission.id, groupId)
      } catch (err) {
        console.warn('mark-completed failed', err)
      }

      const query = new URLSearchParams({
        mission_id: mission.id,
        response_id: data?.response_id ?? '',
        evaluation_id: data?.evaluation_id ?? '',
        completed: conversation.missionCompleted ? '1' : '0',
        mode: challenge.mode,
      })

      try {
        await navigate(`/feedback?${query}`)
      } catch {
        window.location.href = `/feedback?${query}`
      }
    } catch (err) {
      console.error('Submit exception', err)
      alert('Submission failed due to network error')
    } finally {
      setIsSubmitting(false)
      if (!submitted) challenge.resume()
    }
  }

  return { isSubmitting, submit }
}
