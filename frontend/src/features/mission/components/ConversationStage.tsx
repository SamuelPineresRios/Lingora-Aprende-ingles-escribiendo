import { ConversationMessages } from '@/features/mission/components/ConversationMessages'
import { GuestLimitNotice } from '@/features/mission/components/GuestLimitNotice'
import { characterAvatarUrl } from '@/lib/avatar'
import { SceneFigure } from './SceneFigure'
import type { IntroductionCharacter, Mission, MissionMode } from '../types'
import type { MissionConversation } from '../hooks/useMissionConversation'

interface ConversationStageProps {
  mission: Mission
  aiCharacter?: IntroductionCharacter
  studentCharacter?: IntroductionCharacter
  studentAvatar: string | null
  mode: MissionMode
  guestLimit: boolean
  conversation: MissionConversation
  onRetryStart: () => void
}

export function ConversationStage({
  mission,
  aiCharacter,
  studentCharacter,
  studentAvatar,
  mode,
  guestLimit,
  conversation,
  onRetryStart,
}: ConversationStageProps) {
  const characterName = aiCharacter?.name ?? mission.character_name
  const characterGender = aiCharacter?.gender
  const aiRole = aiCharacter?.role ?? 'Lo interpreta la IA'
  const { messages, isThinking, isLastMessageTyping, assistantSpeaking, lastAssistant, lastUser, startError } =
    conversation

  return (
    <div className="flex min-h-0 flex-1 gap-2 px-3 lg:gap-6 lg:px-6">
      <div className="hidden shrink-0 items-end pb-1 lg:flex">
        <SceneFigure
          src={characterAvatarUrl(characterName, characterGender)}
          name={characterName}
          role={aiRole}
          speaking={assistantSpeaking || (!lastUser && messages.length > 0)}
          confused={lastAssistant?.confused === true && !assistantSpeaking}
          glow="drop-shadow-[0_0_28px_rgba(34,211,238,0.55)]"
        />
      </div>

      <div ref={conversation.scrollRef} className="mission-screen-messages min-h-0 flex-1 space-y-3 overflow-y-auto py-2">
        <ConversationMessages
          messages={messages}
          characterName={characterName}
          characterGender={characterGender}
          studentAvatar={studentAvatar}
          isLastMessageTyping={isLastMessageTyping}
          onTypingComplete={conversation.finishTyping}
          enableLookup={mode !== 'evaluation'}
        />

        {isThinking && (
          <div className="flex items-end gap-2.5">
            <img
              src={characterAvatarUrl(characterName, characterGender)}
              alt=""
              className="h-10 w-10 shrink-0 drop-shadow-[0_8px_12px_rgba(0,0,0,0.5)] lg:hidden"
            />
            <div className="rounded-2xl rounded-bl-sm border border-cyan/20 bg-cyan/5 px-4 py-2.5 backdrop-blur-sm">
              <span className="text-xs text-cyan/80 animate-pulse">{characterName} escribiendo…</span>
            </div>
          </div>
        )}

        {messages.length === 0 && !isThinking && !startError && (
          <p className="text-center text-[11px] font-mono uppercase tracking-widest text-slate-500 animate-pulse">
            Preparando la escena…
          </p>
        )}

        {startError && messages.length === 0 && (
          guestLimit ? (
            <GuestLimitNotice message={startError} />
          ) : (
            <div className="mx-auto max-w-md rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-center text-sm text-red-100 space-y-2">
              <p>{startError}</p>
              <button
                onClick={onRetryStart}
                className="text-[11px] font-mono uppercase tracking-widest border border-coral/40 rounded-lg px-3 py-1.5 text-red-100 hover:bg-coral/10 transition-colors"
              >
                Reintentar
              </button>
            </div>
          )
        )}
      </div>

      <div className="hidden shrink-0 items-end pb-1 lg:flex">
        {studentAvatar && (
          <SceneFigure
            src={studentAvatar}
            name={studentCharacter?.name ?? 'Tú'}
            role={studentCharacter?.role ?? 'Tu papel'}
            speaking={!!lastUser && !assistantSpeaking}
            mirrored
            glow="drop-shadow-[0_0_28px_rgba(52,211,153,0.5)]"
          />
        )}
      </div>
    </div>
  )
}
