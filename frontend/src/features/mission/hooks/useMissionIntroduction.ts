import { useCallback, useEffect, useState } from 'react'
import type { MissionIntroduction } from '../types'
import { fetchMissionIntroduction } from '../api'
import {
  getCachedIntroduction,
  prewarmVocabulary,
  setCachedIntroduction,
} from '@/lib/mission-content'

export function useMissionIntroduction(missionId: string) {
  const [introduction, setIntroduction] = useState<MissionIntroduction | null>(
    () => getCachedIntroduction(missionId) ?? null,
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [titleDone, setTitleDone] = useState(false)

  const load = useCallback(async () => {
    if (introduction || loading) return

    setLoading(true)
    setError(null)
    try {
      const { ok, status, data } = await fetchMissionIntroduction(missionId)
      if (!ok || !data?.introduction) {
        throw new Error(
          status === 503 ? 'Servicio de IA no configurado' : data?.error ?? `Error ${status}`,
        )
      }
      setCachedIntroduction(missionId, data.introduction)
      setIntroduction(data.introduction)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la escena')
    } finally {
      setLoading(false)
    }
  }, [introduction, loading, missionId])

  useEffect(() => {
    if (!introduction && !loading && !error) void load()
  }, [introduction, loading, error, load])

  useEffect(() => {
    if (introduction) prewarmVocabulary(missionId)
  }, [introduction, missionId])

  const retry = useCallback(() => {
    setError(null)
    void load()
  }, [load])

  return {
    introduction,
    error,
    loading,
    titleDone,
    markTitleDone: () => setTitleDone(true),
    retry,
  }
}
