import { Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RewritePanel } from './RewritePanel'
import type { MissionMode } from '../types'
import type { MissionConversation } from '../hooks/useMissionConversation'

interface MissionComposerProps {
  mode: MissionMode
  conversation: MissionConversation
  isSubmitting: boolean
}

export function MissionComposer({ mode, conversation, isSubmitting }: MissionComposerProps) {
  const busy = isSubmitting || conversation.isThinking
  const hintsDisabled =
    conversation.hintsLoading ||
    conversation.isThinking ||
    conversation.isLastMessageTyping ||
    conversation.hintsUsedFor === conversation.lastAssistant?.content

  const send = () => {
    void conversation.send()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send()
    }
  }

  return (
    <div className="mission-screen-input shrink-0 px-4 pb-4">
      {conversation.rewrite && (
        <RewritePanel
          mode={mode}
          rewrite={conversation.rewrite}
          hintLevel={conversation.rewriteHintLevel}
          notice={conversation.rewriteNotice}
          onHint={conversation.incrementRewriteHint}
        />
      )}

      {!conversation.rewrite && mode !== 'evaluation' && conversation.lastAssistant && (
        <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
          {conversation.hintsError && (
            <span className="text-[10px] text-coral">{conversation.hintsError}</span>
          )}
          <button
            onClick={() => void conversation.requestHints()}
            disabled={hintsDisabled}
            title="Dos ideas para responder a lo que acaba de decir el personaje"
            className="flex items-center gap-1.5 rounded-lg border border-violet/40 bg-violet/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-violet transition-colors hover:bg-violet/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Lightbulb className="h-3.5 w-3.5" />
            {conversation.hintsLoading ? 'Pidiendo…' : '2 pistas'}
          </button>
        </div>
      )}

      <div
        className={cn(
          'relative rounded-xl border transition-all duration-200 bg-white/5 border-white/10 flex items-end gap-2 p-2 backdrop-blur-sm',
          conversation.currentInput.trim() && 'border-cyan/40 bg-cyan/5',
        )}
      >
        <textarea
          ref={conversation.textareaRef}
          value={conversation.currentInput}
          onChange={event => conversation.setCurrentInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          disabled={busy}
          rows={1}
          className="flex-1 bg-transparent resize-none p-2 text-foreground placeholder:text-slate/40 focus:outline-none text-sm leading-relaxed disabled:opacity-50 max-h-32"
        />
        <button
          onClick={send}
          disabled={!conversation.currentInput.trim() || busy}
          className={cn(
            'p-2 rounded-lg transition-all duration-200 active:scale-95 shrink-0',
            conversation.currentInput.trim()
              ? 'bg-cyan text-black hover:bg-cyan-400'
              : 'bg-white/10 text-slate-500 cursor-not-allowed',
          )}
        >
          <span className="text-xs font-bold uppercase">Send</span>
        </button>
      </div>
      <p className="text-center text-[10px] text-slate/30 mt-1.5 pb-safe">
        Enter to send • Shift+Enter for new line
      </p>
    </div>
  )
}
