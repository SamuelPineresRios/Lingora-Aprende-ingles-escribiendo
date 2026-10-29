import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { checkRewrite } from '@vox/shared'
import { warmWords } from '@/lib/word-cache'
import { openMissionChat, requestMissionHints, sendMissionTurn } from '../api'
import {
  CHAT_OPEN_ATTEMPTS,
  CHAT_RETRY_DELAY_MS,
  HELP_AFTER_FAILURES,
  INPUT_FOCUS_DELAY_MS,
  MODAL_FOCUS_DELAY_MS,
} from '../constants'
import type {
  ChatMessage,
  GrammarCorrection,
  GrammarNotice,
  Mission,
  MissionHint,
  MissionMode,
  MissionRewrite,
  StepHint,
} from '../types'

interface MissionConversationParams {
  mission: Mission
  userLevel: string
  onMistake: () => void
  flagGuestLimit: (data: unknown) => boolean
}

export interface MissionConversation {
  messages: ChatMessage[]
  currentInput: string
  setCurrentInput: (value: string) => void
  isThinking: boolean
  isLastMessageTyping: boolean
  assistantSpeaking: boolean
  lastAssistant: ChatMessage | undefined
  lastUser: ChatMessage | undefined
  startError: string | null
  missionProgress: number
  missionCompleted: boolean
  completionOpen: boolean
  grammarNotices: GrammarNotice[]
  stepHints: StepHint[]
  grammarCorrection: GrammarCorrection | null
  rewrite: MissionRewrite | null
  rewriteHintLevel: number
  rewriteNotice: string | null
  hints: MissionHint[]
  hintsOpen: boolean
  hintsLoading: boolean
  hintsError: string
  hintsUsedFor: string | null
  finishTyping: () => void
  scrollRef: RefObject<HTMLDivElement>
  textareaRef: RefObject<HTMLTextAreaElement>
  open: (mode: MissionMode) => Promise<void>
  send: () => Promise<void>
  requestHints: () => Promise<void>
  closeHints: (focus?: boolean) => void
  dismissGrammarCorrection: () => void
  dismissGrammarNotice: (id: string) => void
  dismissStepHint: (id: string) => void
  incrementRewriteHint: () => void
  dismissCompletion: () => void
  markSubmitted: () => void
  resetProgress: () => void
  resetRun: () => void
}

export function useMissionConversation({
  mission,
  userLevel,
  onMistake,
  flagGuestLimit,
}: MissionConversationParams): MissionConversation {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentInput, setCurrentInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [isLastMessageTyping, setIsLastMessageTyping] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const [grammarNotices, setGrammarNotices] = useState<GrammarNotice[]>([])
  const [stepHints, setStepHints] = useState<StepHint[]>([])
  const [stepFailures, setStepFailures] = useState(0)

  const [grammarCorrection, setGrammarCorrection] = useState<GrammarCorrection | null>(null)
  const [rewrite, setRewrite] = useState<MissionRewrite | null>(null)
  const [rewriteHintLevel, setRewriteHintLevel] = useState(0)
  const [rewriteNotice, setRewriteNotice] = useState<string | null>(null)

  const [hints, setHints] = useState<MissionHint[]>([])
  const [hintsOpen, setHintsOpen] = useState(false)
  const [hintsLoading, setHintsLoading] = useState(false)
  const [hintsError, setHintsError] = useState('')
  const [hintsUsedFor, setHintsUsedFor] = useState<string | null>(null)

  const [missionProgress, setMissionProgress] = useState(0)
  const [missionCompleted, setMissionCompleted] = useState(false)
  const [completionOpen, setCompletionOpen] = useState(false)
  const [hasNotifiedCompletion, setHasNotifiedCompletion] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const modeRef = useRef<MissionMode>('free')
  const lastAssistant = [...messages].reverse().find(message => message.role === 'assistant')
  const lastUser = [...messages].reverse().find(message => message.role === 'user')
  const assistantSpeaking = isThinking || isLastMessageTyping

  const focusInput = useCallback((delay = INPUT_FOCUS_DELAY_MS) => {
    setTimeout(() => textareaRef.current?.focus(), delay)
  }, [])

  const restoreFailedMessage = useCallback(
    (failedMessage: ChatMessage, notice: string) => {
      setMessages(current => [
        ...current.filter(message => message !== failedMessage),
        { role: 'system', content: notice },
      ])
      setCurrentInput(failedMessage.content)
      focusInput()
    },
    [focusInput],
  )

  const open = useCallback(
    async (mode: MissionMode) => {
      modeRef.current = mode
      setStartError(null)
      setIsThinking(true)

      const context = { mode, mission, userLevel }
      let lastError = 'El coach no pudo responder. Reintenta en unos segundos.'

      for (let attempt = 1; attempt <= CHAT_OPEN_ATTEMPTS; attempt++) {
        try {
          const { ok, status, data } = await openMissionChat(context)

          if (!ok || !data?.message) {
            lastError = data?.error ?? 'El coach no pudo responder. Reintenta en unos segundos.'
            if (flagGuestLimit(data)) {
              setStartError(lastError)
              setIsThinking(false)
              return
            }
            console.warn(`[chat] Arranque fallido (intento ${attempt}):`, status, data)
          } else {
            setMessages([data.message])
            setIsLastMessageTyping(true)
            setIsThinking(false)
            focusInput()
            return
          }
        } catch (err) {
          lastError = 'No hay conexión con el coach. Reintenta en unos segundos.'
          console.warn(`[chat] Arranque fallido (intento ${attempt}):`, err)
        }

        if (attempt < CHAT_OPEN_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, CHAT_RETRY_DELAY_MS))
        }
      }

      setStartError(lastError)
      setIsThinking(false)
    },
    [mission, userLevel, flagGuestLimit, focusInput],
  )

  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last?.role === 'assistant') warmWords([last.content])
  }, [messages])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isThinking, isLastMessageTyping])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [currentInput])

  const send = async () => {
    if (!currentInput.trim() || isThinking) return

    if (rewrite) {
      const check = checkRewrite(currentInput, rewrite)
      if (!check.accepted) {
        const missing = [...new Set(check.missing)].slice(0, 4)
        setRewriteNotice(
          missing.length > 0
            ? `Aún no se entiende igual que la corrección. Falta: ${missing.join(', ')}. Corrígelo con tus propias palabras.`
            : 'Aún no se entiende igual que la corrección. Revisa el orden o la forma verbal y vuelve a intentarlo con tus palabras.',
        )
        return
      }
      setRewrite(null)
      setRewriteHintLevel(0)
      setRewriteNotice(null)
    }

    setHintsOpen(false)

    const userMsg: ChatMessage = { role: 'user', content: currentInput.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setCurrentInput('')
    setIsThinking(true)
    setIsLastMessageTyping(false)

    try {
      const { ok, data } = await sendMissionTurn(
        { mode: modeRef.current, mission, userLevel },
        newMessages,
      )

      if (!ok && flagGuestLimit(data)) {
        setIsThinking(false)
        return
      }

      if (data?.message) {
        const isA1Tier1 = mission.cefr_level === 'A1' && mission.tier === 1
        const correctedText =
          typeof data.correctedText === 'string' ? data.correctedText.trim() : ''
        const errorType = typeof data.error_type === 'string' ? data.error_type : ''

        if (!isA1Tier1 && errorType && correctedText) {
          setMessages(current => current.filter(message => message !== userMsg))
          setCurrentInput('')
          setGrammarCorrection({
            original: userMsg.content,
            corrected: correctedText,
            explanation:
              data.feedback || data.missingStep || 'Revisa la gramática de la frase.',
            errorType,
          })
          setRewrite({ original: userMsg.content, corrected: correctedText, errorType })
          setRewriteHintLevel(0)
          setRewriteNotice(null)
          onMistake()
          return
        }

        const assistant: ChatMessage = {
          ...data.message,
          rating: undefined,
          confused: data.confused === true,
        }

        setMessages(current => {
          const updated = [...current]
          const lastUserIdx = updated.findLastIndex(message => message.role === 'user')
          if (lastUserIdx !== -1) {
            updated[lastUserIdx] = {
              ...updated[lastUserIdx],
              rating: data.message?.rating,
              feedback: data.feedback,
              correctedText: data.correctedText,
            }
          }
          return [...updated, assistant]
        })

        if (data.message.rating && data.message.rating >= 1 && data.message.rating <= 3) {
          const failures = stepFailures + 1
          setStepFailures(failures)

          if (failures >= HELP_AFTER_FAILURES) {
            const correctedVersion = data.correctedText || '[Respuesta rechazada]'
            setGrammarNotices(current => [
              ...current,
              {
                id: `notice-${crypto.randomUUID()}`,
                original: userMsg.content,
                corrected: correctedVersion,
                feedback: data.feedback || 'Tu respuesta no es correcta para esta pregunta.',
              },
            ])
          } else if (data.missingStep) {
            const missing = data.missingStep
            setStepHints(current => [
              ...current,
              { id: `hint-${crypto.randomUUID()}`, missing },
            ])
          }

          onMistake()
        }

        setIsLastMessageTyping(true)

        if (data.progress !== undefined) setMissionProgress(data.progress)

        if (data.message.rating && data.message.rating >= 4) {
          setStepFailures(0)
          setStepHints([])
        }

        const isComplete =
          data.mission_completed === true ||
          (typeof data.progress === 'number' && data.progress >= 100)

        if (isComplete) {
          setMissionProgress(100)
          setMissionCompleted(true)
          if (!hasNotifiedCompletion) {
            setCompletionOpen(true)
            setHasNotifiedCompletion(true)
          }
        }
      } else {
        console.error('API Error', data)
        restoreFailedMessage(
          userMsg,
          '⚠️ No se pudo contactar con el personaje. Tu mensaje sigue en el cuadro de texto: vuelve a enviarlo.',
        )
      }
    } catch (err) {
      console.error('Failed to send message', err)
      restoreFailedMessage(
        userMsg,
        '⚠️ Sin conexión con el personaje. Tu mensaje sigue en el cuadro de texto: vuelve a enviarlo.',
      )
    } finally {
      setIsThinking(false)
    }
  }

  const requestHints = async () => {
    if (!lastAssistant || hintsLoading) return

    setHintsLoading(true)
    setHintsError('')
    try {
      const { ok, data } = await requestMissionHints({
        lastMessage: lastAssistant.content,
        mission,
        userLevel,
      })
      const list = Array.isArray(data?.hints)
        ? data.hints.filter(
            (hint): hint is MissionHint =>
              typeof hint?.en === 'string' && typeof hint?.es === 'string',
          )
        : []

      if (!ok || list.length < 2) {
        throw new Error(
          typeof data?.error === 'string' ? data.error : 'No se pudieron pedir las pistas.',
        )
      }

      setHints(list.slice(0, 2))
      setHintsOpen(true)
      setHintsUsedFor(lastAssistant.content)
    } catch (err) {
      setHintsError(err instanceof Error ? err.message : 'No se pudieron pedir las pistas.')
    } finally {
      setHintsLoading(false)
    }
  }

  const closeHints = (focus = false) => {
    setHintsOpen(false)
    if (focus) focusInput(MODAL_FOCUS_DELAY_MS)
  }

  const dismissGrammarCorrection = () => {
    setGrammarCorrection(null)
    focusInput(MODAL_FOCUS_DELAY_MS)
  }

  const dismissGrammarNotice = (id: string) => {
    setGrammarNotices(current => current.filter(notice => notice.id !== id))
  }

  const dismissStepHint = (id: string) => {
    setStepHints(current => current.filter(hint => hint.id !== id))
  }

  return {
    messages,
    currentInput,
    setCurrentInput,
    isThinking,
    isLastMessageTyping,
    assistantSpeaking,
    lastAssistant,
    lastUser,
    startError,
    missionProgress,
    missionCompleted,
    completionOpen,
    grammarNotices,
    stepHints,
    grammarCorrection,
    rewrite,
    rewriteHintLevel,
    rewriteNotice,
    hints,
    hintsOpen,
    hintsLoading,
    hintsError,
    hintsUsedFor,
    finishTyping: () => setIsLastMessageTyping(false),
    scrollRef,
    textareaRef,
    open,
    send,
    requestHints,
    closeHints,
    dismissGrammarCorrection,
    dismissGrammarNotice,
    dismissStepHint,
    incrementRewriteHint: () => setRewriteHintLevel(level => Math.min(level + 1, 3)),
    dismissCompletion: () => setCompletionOpen(false),
    markSubmitted: () => setMissionProgress(100),
    resetProgress: () => setMissionProgress(0),
    resetRun: () => {
      setMissionCompleted(false)
      setCompletionOpen(false)
    },
  }
}
