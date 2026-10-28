import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/lib/hooks/useAuth'
import { MissionScreen } from '@/features/mission/MissionScreen'
import { readJson } from '@/lib/api'

export default function MissionPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id: missionId = '' } = useParams()
  const [mission, setMission] = useState<any>(null)
  const [error, setError] = useState<string|null>(null)
  const [loading, setLoading] = useState(true)
  const [search] = useSearchParams()
  const groupId = search.get('group_id')

  useEffect(() => {
    console.log('[Mission Page] Loading mission:', missionId)
    fetch(`/api/missions/${missionId}`)
      .then((r) => {
        console.log('[Mission Page] Response status:', r.status)
        return readJson(r)
      })
      .then((d) => {
        console.log('[Mission Page] Response data:', d)
        if (d?.error) {
          setError(d?.error ?? 'No se pudo cargar la misión')
        } else {
          setMission(d?.mission ?? null)
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error('[Mission Page] Fetch error:', err)
        setError('Failed to load mission: ' + err.message)
        setLoading(false)
      })
  }, [missionId])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <p className="text-coral font-bold">Error: {error}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-cyan/20 text-cyan rounded hover:bg-cyan/30"
        >
          Volver
        </button>
      </div>
    )
  }

  if (!mission) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-light">Misión no encontrada</p>
      </div>
    )
  }

  return (
    <MissionScreen
      mission={mission}
      studentId={user.id}
      groupId={groupId ?? undefined}
    />
  )
}

