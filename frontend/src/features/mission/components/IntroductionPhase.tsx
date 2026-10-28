import { IntroductionPlayer } from '@/components/IntroductionPlayer'
import { MissionTitleCard } from '@/components/MissionTitleCard'
import type { Mission, MissionIntroduction } from '../types'

interface IntroductionPhaseProps {
  mission: Mission
  studentAvatar: string | null
  introduction: MissionIntroduction | null
  loading: boolean
  error: string | null
  titleDone: boolean
  onTitleDone: () => void
  onRetry: () => void
  onContinueWithoutScene: () => void
  onFinish: () => void
  onSkip: () => void
  onSkipToMission: () => void
}

export function IntroductionPhase({
  mission,
  studentAvatar,
  introduction,
  loading,
  error,
  titleDone,
  onTitleDone,
  onRetry,
  onContinueWithoutScene,
  onFinish,
  onSkip,
  onSkipToMission,
}: IntroductionPhaseProps) {
  if (loading) {
    return <div className="min-h-screen bg-slate-950" />
  }

  if (error || !introduction) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center">
        <p className="text-coral font-bold">No se pudo cargar la escena</p>
        <p className="text-xs text-slate-400 max-w-xs">{error ?? 'Respuesta vacía'}</p>
        <div className="flex gap-2">
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-lg bg-cyan text-black text-xs font-bold uppercase tracking-widest"
          >
            Reintentar
          </button>
          <button
            onClick={onContinueWithoutScene}
            className="px-4 py-2 rounded-lg border border-white/15 text-slate-300 text-xs uppercase tracking-widest"
          >
            Continuar sin escena
          </button>
        </div>
      </div>
    )
  }

  if (!titleDone) {
    return (
      <MissionTitleCard
        title={introduction.scene_title}
        description={introduction.scene_description}
        backdrop={introduction.backdrop}
        seed={mission.id}
        characters={introduction.characters}
        studentAvatar={studentAvatar}
        onDone={onTitleDone}
      />
    )
  }

  return (
    <IntroductionPlayer
      introduction={introduction}
      cefrLevel={mission.cefr_level}
      onFinish={onFinish}
      onSkip={onSkip}
      onSkipToMission={onSkipToMission}
    />
  )
}
