import { useState } from 'react'
import { Languages } from 'lucide-react'
import { TypewriterMessage } from './TypewriterMessage'
import { InteractiveWords } from './InteractiveWords'
import { characterAvatarUrl, type AvatarGender } from '@/lib/avatar'

/**
 * Un turno de la conversación, tal y como viaja hacia y desde /api/chat.
 *
 * Vive aquí (y no en MissionScreen) porque el historial y la cabecera de la
 * misión son los dos consumidores y este archivo es el dueño del contrato.
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  /** Traducción al español del mensaje del personaje (la da la IA en el turno). */
  translation?: string
  feedback?: string
  rating?: number
  correctedText?: string
  /** El personaje se quedó confundido (fuera de tema o error gramatical). */
  confused?: boolean
}

/** Traducción plegable de un mensaje del personaje. */
function TranslationToggle({ translation }: { translation: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(value => !value)}
        className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-cyan/25 px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-cyan/70 transition-colors hover:border-cyan/50 hover:text-cyan"
      >
        <Languages className="h-3 w-3" /> {open ? 'Ocultar' : 'Traducción'}
      </button>
      {open && (
        <p className="mt-2 border-t border-cyan/15 pt-2 font-reading text-sm italic leading-relaxed text-cyan-100/80">
          {translation}
        </p>
      )}
    </>
  )
}

function AssistantBubble({
  message,
  characterName,
  characterGender,
  typing,
  onTypingComplete,
}: {
  message: ChatMessage
  characterName: string
  characterGender?: AvatarGender
  typing: boolean
  onTypingComplete: () => void
}) {
  return (
    <div className="flex items-end gap-2.5">
      <img
        src={characterAvatarUrl(characterName, characterGender)}
        alt=""
        className="h-10 w-10 shrink-0 drop-shadow-[0_8px_12px_rgba(0,0,0,0.5)] lg:hidden"
      />
      <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-cyan/25 bg-cyan/10 px-4 py-3 backdrop-blur-sm lg:max-w-[78%]">
        <p className="text-[10px] font-mono uppercase tracking-widest text-cyan">{characterName}</p>
        <p className="mt-1 font-reading text-lg leading-relaxed text-cyan-50 sm:text-xl">
          {typing ? (
            <TypewriterMessage text={message.content} isActive speed={30} onComplete={onTypingComplete} />
          ) : (
            <InteractiveWords text={message.content} context={message.content} />
          )}
        </p>
        {message.translation && <TranslationToggle translation={message.translation} />}
      </div>
    </div>
  )
}

function UserBubble({ message, studentAvatar }: { message: ChatMessage; studentAvatar: string | null }) {
  return (
    <div className="flex flex-row-reverse items-end gap-2.5">
      {studentAvatar && (
        <img
          src={studentAvatar}
          alt=""
          className="h-10 w-10 shrink-0 drop-shadow-[0_8px_12px_rgba(0,0,0,0.5)] lg:hidden"
        />
      )}
      <div className="flex max-w-[92%] flex-col items-end gap-2 lg:max-w-[78%]">
        <div className="rounded-2xl rounded-br-sm border border-emerald/25 bg-emerald/10 px-4 py-3 backdrop-blur-sm">
          <p className="text-right text-[10px] font-mono uppercase tracking-widest text-emerald">
            TÚ
            {message.rating && <span className="ml-2 text-amber-400">{'★'.repeat(message.rating)}</span>}
          </p>
          <p className="mt-1 text-base leading-relaxed text-emerald-50 sm:text-lg">{message.content}</p>
        </div>

        {message.feedback && (
          <div className="flex flex-col items-end gap-1 animate-in fade-in slide-in-from-top-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber">AI Coach</span>
            <p className="max-w-xl rounded-lg border border-amber/15 bg-amber/10 px-3 py-2 text-left text-xs text-amber/90 backdrop-blur-sm">
              {message.feedback}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Historial completo de la conversación: cada intercambio queda a la vista,
 * como en un chat. La última respuesta del personaje se escribe sola.
 */
export function ConversationMessages({
  messages,
  characterName,
  characterGender,
  studentAvatar,
  isLastMessageTyping,
  onTypingComplete,
}: {
  messages: ChatMessage[]
  characterName: string
  characterGender?: AvatarGender
  studentAvatar: string | null
  isLastMessageTyping: boolean
  onTypingComplete: () => void
}) {
  const lastAssistantIndex = messages.findLastIndex(message => message.role === 'assistant')

  return (
    <>
      {messages.map((message, index) => {
        if (message.role === 'assistant') {
          return (
            <AssistantBubble
              key={index}
              message={message}
              characterName={characterName}
              characterGender={characterGender}
              typing={index === lastAssistantIndex && isLastMessageTyping}
              onTypingComplete={onTypingComplete}
            />
          )
        }
        if (message.role === 'user') {
          return <UserBubble key={index} message={message} studentAvatar={studentAvatar} />
        }
        return null
      })}
    </>
  )
}
