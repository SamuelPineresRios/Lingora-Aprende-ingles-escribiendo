import { MissionBackdrop } from '@/features/mission/components/MissionBackdrop'
import { GuestLimitNotice } from '@/features/mission/components/GuestLimitNotice'
import { resolveBackdrop } from '@/lib/mission-backdrop'
import type { StudentProgress } from '@/lib/hooks/useProgress'
import { ConversationStage } from './ConversationStage'
import { MissionComposer } from './MissionComposer'
import { MissionHeader } from './MissionHeader'
import type { IntroductionCharacter, Mission, MissionMode } from '../types'
import type { MissionConversation } from '../hooks/useMissionConversation'

interface MissionChatProps {
  mission: Mission
  studentAvatar: string | null
  aiCharacter?: IntroductionCharacter
  studentCharacter?: IntroductionCharacter
  progress: StudentProgress | null
  mode: MissionMode
  hearts: number
  missionProgress: number
  guestLimit: boolean
  conversation: MissionConversation
  isSubmitting: boolean
  onBack: () => void
  onRetryStart: () => void
}

export function MissionChat({
  mission,
  studentAvatar,
  aiCharacter,
  studentCharacter,
  progress,
  mode,
  hearts,
  missionProgress,
  guestLimit,
  conversation,
  isSubmitting,
  onBack,
  onRetryStart,
}: MissionChatProps) {
  return (
    <div
      data-font-legacy
      className="flex h-[calc(100dvh-4rem)] w-full flex-col relative overflow-y-auto overscroll-contain lg:h-dvh lg:overflow-hidden"
    >
      <MissionBackdrop
        backdrop={resolveBackdrop(mission.backdrop, `${mission.title} ${mission.scene_context}`)}
        seed={mission.id}
        variant="scene"
        className="opacity-60"
      />
      <div className="absolute inset-0 bg-slate-950/60" />

      <div className="relative z-10 grid flex-1 min-h-0 gap-4 lg:gap-6">
        <div className="flex flex-col min-h-0">
          <MissionHeader
            mission={mission}
            progress={progress}
            missionProgress={missionProgress}
            mode={mode}
            hearts={hearts}
            onBack={onBack}
          />
          <ConversationStage
            mission={mission}
            aiCharacter={aiCharacter}
            studentCharacter={studentCharacter}
            studentAvatar={studentAvatar}
            mode={mode}
            guestLimit={guestLimit}
            conversation={conversation}
            onRetryStart={onRetryStart}
          />
          {guestLimit && conversation.messages.length > 0 && <GuestLimitNotice compact />}
          <MissionComposer mode={mode} conversation={conversation} isSubmitting={isSubmitting} />
        </div>
      </div>
    </div>
  )
}
