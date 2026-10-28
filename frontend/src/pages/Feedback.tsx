import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { FeedbackScreen } from '@/components/FeedbackScreen'
import { readJson } from '@/lib/api'

function FeedbackContent() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const evalId = params.get('evaluation_id')
    const missionId = params.get('mission_id')
    // Lo que decide el badge es el resultado de la conversación, no la nota.
    const missionCompleted = params.get('completed') === '1'
    const mode = params.get('mode') === 'free' ? ('free' as const) : ('evaluation' as const)
    if (!evalId || !missionId) { navigate('/missions'); return }

    Promise.all([
      fetch(`/api/missions/${missionId}`).then(readJson),
      fetch(`/api/evaluations/${evalId}`).then(readJson),
    ]).then(([missionData, evalData]) => {
      setData({
        evaluation: evalData?.evaluation,
        missionTitle: missionData?.mission?.title ?? '',
        missionCompleted,
        mode,
        missionId,
      })
      setLoading(false)
    }).catch(() => { navigate('/missions') })
  }, [params, navigate])

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-amber/30 border-t-amber rounded-full animate-spin"/></div>
  if (!data) return null
  return <FeedbackScreen
    evaluation={data.evaluation}
    missionTitle={data.missionTitle}
    missionCompleted={data.missionCompleted}
    mode={data.mode}
    missionId={data.missionId}
    onTryAgain={() => navigate(-1)}
    onNextMission={() => navigate('/missions')}
  />
}

export default function FeedbackPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-amber/30 border-t-amber rounded-full animate-spin"/></div>}><FeedbackContent /></Suspense>
}
