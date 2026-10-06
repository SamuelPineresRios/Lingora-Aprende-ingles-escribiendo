import { useState, useRef, useEffect, useCallback } from 'react'
import type { MissionBackdrop as MissionBackdropSpec, MissionIntroduction } from '@vox/shared'
import { useNavigate } from 'react-router-dom'
import { Timer } from './Timer'
import { TypewriterMessage } from './TypewriterMessage'
import { InteractiveWords } from './InteractiveWords'
import { VocabularyQuiz } from './VocabularyQuiz'
import { XpBar } from './XpBar'
import { useProgress } from '@/lib/hooks/useProgress'
import { warmWords } from '@/lib/word-cache'
import { GrammarToastStack, HeartMeter, type GrammarNotice } from './GrammarToast'
import { StepHintStack, type StepHint } from './StepHintToast'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/hooks/useAuth'
import { readJson } from '@/lib/api'
import { avatarUrl } from '@/lib/avatar'
import { resolveBackdrop } from '@/lib/mission-backdrop'
import { IntroductionPlayer } from '@/components/IntroductionPlayer'
import { MissionBackdrop } from '@/components/MissionBackdrop'
import { ConversationLog } from '@/components/ConversationLog'


/** Avatar pequeño del personaje para el chat: el mismo de la escena. */
function ChatAvatar({ name }: { name: string }) {
  return (
    <img
      src={avatarUrl(name)}
      alt=""
      className="h-10 w-10 shrink-0 drop-shadow-[0_8px_12px_rgba(0,0,0,0.5)]"
    />
  )
}


interface Mission {
  id: string; title: string; objective: string; scene_context: string
  character_name: string; cefr_level: string; base_duration_seconds: number
  key_verbs?: string[]
  useful_phrases?: string[]
  grammar_tips?: string
  /** Dirección de arte del fondo; nula si la escena es anterior a la función. */
  backdrop?: MissionBackdropSpec | null
}


interface MissionScreenProps {
  mission: Mission; studentId: string; groupId?: string
}
    type MissionState = 'introduction' | 'vocabulary' | 'preparation' | 'active' | 'submitting'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  feedback?: string
  rating?: number // 1-5
  correctedText?: string // Corrected version if exists
}

export function MissionScreen({ mission, studentId, groupId }: MissionScreenProps) {
  const { user } = useAuth()
  const [state, setState] = useState<MissionState>('introduction')

  const [missionMode, setMissionMode] = useState<'free' | 'evaluation'>('free')
  const [messages, setMessages] = useState<Message[]>([])
  const [currentInput, setCurrentInput] = useState('')
  const [startTime, setStartTime] = useState<number | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [isLastMessageTyping, setIsLastMessageTyping] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const { progress } = useProgress(user?.id)
  const [showCompletionNotification, setShowCompletionNotification] = useState(false)
  /** El titular terminó de escribirse: salen la línea y el subtítulo. */
  const [completionTyped, setCompletionTyped] = useState(false)
  /** Y un poco después, los botones. */
  const [completionActions, setCompletionActions] = useState(false)
  const [hasNotifiedCompletion, setHasNotifiedCompletion] = useState(false)
  const [missionProgress, setMissionProgress] = useState(0)
  const [timerDuration, setTimerDuration] = useState(mission.base_duration_seconds)
  const [timerKey, setTimerKey] = useState(0)
  
  // Correcciones en curso: cada una es una notificación en la esquina.
  const [grammarNotices, setGrammarNotices] = useState<GrammarNotice[]>([])
  /** Avisos suaves de "te falta X": se van solos. */
  const [stepHints, setStepHints] = useState<StepHint[]>([])
  /** Fallos seguidos en el paso actual; al tercero llega la corrección completa. */
  const [stepFailures, setStepFailures] = useState(0)

  // Desafío: 3 corazones. Cada frase fuera de tema o mal gramaticalmente cuesta uno.
  const TOTAL_HEARTS = 3
  /** Fallos seguidos en el mismo paso antes de mostrar la forma correcta. */
  const HELP_AFTER_FAILURES = 3
  const [hearts, setHearts] = useState(TOTAL_HEARTS)
  const [showFailedNotification, setShowFailedNotification] = useState(false)
  /** Lo dice la conversación (mission_completed), no el evaluador del reporte. */
  const [missionCompleted, setMissionCompleted] = useState(false)

  // Escena narrativa: se pide a la API (genera la primera vez) y se recuerda
  // mientras el alumno está en la pantalla, para no repetir la espera.
  const [introduction, setIntroduction] = useState<MissionIntroduction | null>(null)
  const [introductionError, setIntroductionError] = useState<string | null>(null)
  const [loadingIntroduction, setLoadingIntroduction] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const navigate = useNavigate()

  // Initial bot message on start (when button clicked)
  const startMission = useCallback(async (mode: 'free' | 'evaluation') => {
    setMissionMode(mode)
    setState('active'); setStartTime(Date.now())
    setIsThinking(true)
    setHearts(TOTAL_HEARTS)
    setShowFailedNotification(false)
    setMissionCompleted(false)
    
    // Initial system prompt + optional fake first message or trigger API
    // Let's trigger the API to get the first greeting based on context
    try {
        const initialMessages: Message[] = []
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                mode: 'chat',
                missionMode: mode,
                messages: initialMessages, 
                mission, 
                userLevel: user?.cefr_level || mission.cefr_level 
            })
        })
        const data = await readJson(res)
        if (data?.message) {
            setMessages([data.message])
            setIsLastMessageTyping(true)
            if (mode === 'evaluation' && data.estimated_time) {
                setTimerDuration(data.estimated_time)
                setTimerKey(prev => prev + 1)
                setTimedOut(false)
            }
        } else {
            console.error('No message in start response', data)
            // Fallback message if API fails
            setMessages([{ role: 'assistant', content: "System: Connection established. Please initiate the conversation." }])
            setIsLastMessageTyping(true)
        }
    } catch (e) {
        console.error(e)
        // Fallback message if API fails
        setMessages([{ role: 'assistant', content: "System: Connection error. Please try refreshing." }])
        setIsLastMessageTyping(true)
    } finally {
        setIsThinking(false)
        setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [mission, user])

  /**
   * Un envío fallido no debe dejar al alumno bloqueado: se retira su mensaje
   * del chat y se devuelve al cuadro de texto para reintentar con un toque.
   */
  const restoreFailedMessage = (failedMessage: Message, notice: string) => {
    setMessages(current => [
      ...current.filter(message => message !== failedMessage),
      { role: 'system', content: notice },
    ])
    setCurrentInput(failedMessage.content)
    setTimeout(() => textareaRef.current?.focus(), 100)
  }

  /**
   * Calienta las palabras de cada respuesta de la IA al aparecer, para que el
   * hover las encuentre ya traducidas.
   */
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last?.role === 'assistant') warmWords([last.content])
  }, [messages])

  const handleSendMessage = async () => {
    if (!currentInput.trim() || isThinking) return;
    
    const userMsg: Message = { role: 'user', content: currentInput.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setCurrentInput('')
    setIsThinking(true)
    setIsLastMessageTyping(false)
    setTimedOut(false) // Reset timeout state on user action

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                mode: 'chat',
                missionMode,
                messages: newMessages, 
                mission, 
                userLevel: user?.cefr_level || mission.cefr_level 
            })
        })
        const data = await readJson(res)
        if (data?.message) {
            // Store the rating on the *User's* message (the one we just sent)
            // But the API returns the rating for the *User's* message in the *Assistant's* payload usually.
            // Wait, the API returns { message: { role: 'assistant', ... }, feedback: ..., rating: ... }
            // Let's attach the rating to the ASSISTANT message for easier rendering, 
            // OR update the previous user message. Updating state array is harder.
            // Let's attach it to the incoming message object as metadata about the *previous* turn.
            
            const newAssistantMsg = { 
                ...data.message, 
                // feedback: data.feedback, // DON'T attach feedback to assistant message 
                rating: undefined 
            }
            // Update the LAST user message with the feedback and rating
             setMessages(current => {
                const updated = [...current]
                const lastUserIdx = updated.findLastIndex(m => m.role === 'user')
                if (lastUserIdx !== -1) {
                    updated[lastUserIdx] = { 
                        ...updated[lastUserIdx], 
                        rating: data.message.rating,
                        feedback: data.feedback, // Attach feedback here!
                        correctedText: data.correctedText
                    }
                }
                return [...updated, newAssistantMsg]
             })
            
            // Frase incompleta o con errores (rating 1-3). La ayuda va por
            // niveles: primero sólo qué falta; si insiste, la forma correcta.
            if (data.message.rating && data.message.rating >= 1 && data.message.rating <= 3) {
              const failures = stepFailures + 1
              setStepFailures(failures)

              if (failures >= HELP_AFTER_FAILURES) {
                // Ya ha fallado varias veces en el mismo paso: corrección completa.
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
                // Aún está cerca: se le dice qué falta, nunca cómo decirlo.
                setStepHints(current => [
                  ...current,
                  { id: `hint-${crypto.randomUUID()}`, missing: data.missingStep },
                ])
              }

              // En el Desafío cada frase mal cuesta un corazón; sin corazones,
              // el desafío se acaba.
              if (missionMode === 'evaluation') {
                setHearts(current => {
                  const remaining = Math.max(current - 1, 0)
                  if (remaining === 0) setShowFailedNotification(true)
                  return remaining
                })
              }
            }
            
            // Enable typewriter effect for the new assistant message
            setIsLastMessageTyping(true)

            if (missionMode === 'evaluation' && data.estimated_time) {
                setTimerDuration(data.estimated_time)
                setTimerKey(prev => prev + 1)
            }
            
            // Update Mission Progress from API
            if (data.progress !== undefined) {
                setMissionProgress(data.progress)
            }

            // Auto-complete if mission passed
            const isComplete = data.mission_completed || (data.progress && data.progress >= 100);
            if (data.message.rating && data.message.rating >= 4) {
              // Paso superado: el siguiente empieza con el contador a cero.
              setStepFailures(0)
              setStepHints([])
            }

            if (isComplete) {
                setMissionProgress(100)
                setMissionCompleted(true)
                
                // Show completion modal ONLY if we haven't already notified the user
                if (!hasNotifiedCompletion) {
                    setShowCompletionNotification(true)
                    setHasNotifiedCompletion(true)
                }
            } else {
                 // Check if progress reached 100 without explicit completion flag, just in case
                 if (missionProgress >= 100 && !hasNotifiedCompletion) {
                    setShowCompletionNotification(true)
                    setHasNotifiedCompletion(true)
                 }
            }
        } else {
            console.error("API Error", data)
            restoreFailedMessage(
                userMsg,
                '⚠️ No se pudo contactar con el personaje. Tu mensaje sigue en el cuadro de texto: vuelve a enviarlo.',
            )
        }
    } catch (e) {
        console.error("Failed to send message", e)
        restoreFailedMessage(
            userMsg,
            '⚠️ Sin conexión con el personaje. Tu mensaje sigue en el cuadro de texto: vuelve a enviarlo.',
        )
    } finally {
        setIsThinking(false)
    }
  }

  const dismissGrammarNotice = (id: string) => {
    setGrammarNotices(current => current.filter(notice => notice.id !== id))
  }

  const dismissStepHint = (id: string) => {
    setStepHints(current => current.filter(hint => hint.id !== id))
  }

  // Revelado en cadena del aviso de misión completada: al terminar de
  // escribirse el titular salen el subtítulo y, un momento después, los
  // botones. Nada aparece de golpe.
  useEffect(() => {
    if (!completionTyped) return
    const timer = setTimeout(() => setCompletionActions(true), 900)
    return () => clearTimeout(timer)
  }, [completionTyped])

  const handleCompleteMission = async () => {
    if (state !== 'active') return
    if (!user?.id) {
      alert('Error: User not found. Please log in again.')
      return
    }
    const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : null
    setState('submitting'); setIsThinking(true)
    
    // Sólo las frases del alumno: si se envía el diálogo entero, el evaluador
    // cree que el estudiante escribió también lo del agente y hunde la nota.
    const studentTurns = messages.filter(m => m.role === 'user').map(m => m.content)
    if (studentTurns.length === 0) {
        alert('Envía al menos una frase antes de enviar el reporte.')
        setState('active'); setIsThinking(false)
        return
    }
    const transcript = studentTurns.join('\n\n')

        try {
            const res = await fetch(`/api/missions/${mission.id}/submit`, {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ response_text: transcript, student_id: studentId, group_id: groupId, time_taken_seconds: timeTaken }),
            })
            const data = await readJson(res)

            if (!res.ok) {
                console.error('Submission error', data)
                // Revert UI state and show brief alert to user
                setState('active'); setIsThinking(false)
                alert('Submission failed: ' + (data?.error || 'Unknown error'))
                return
            }

                        // Mark progress locally so UI reflects completion immediately
                        setMissionProgress(100)

                        // Also request server to explicitly persist narrative_state as completed
                        try {
                            await fetch(`/api/missions/${mission.id}/mark-completed`, {
                                method: 'POST', 
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ group_id: groupId ?? null }),
                            })
                        } catch (e) {
                            console.warn('mark-completed failed', e)
                        }

                        // Build query and navigate. Use full navigation fallback to ensure server data is loaded.
                        const p = new URLSearchParams({
            mission_id: mission.id,
            response_id: data.response_id,
            evaluation_id: data.evaluation_id,
            completed: missionCompleted ? '1' : '0',
        })
                        try {
                                await navigate(`/feedback?${p}`)
                        } catch {
                                // Fallback to full navigation
                                window.location.href = `/feedback?${p}`
                        }
        } catch (err) {
            console.error('Submit exception', err)
            setState('active'); setIsThinking(false)
            alert('Submission failed due to network error')
        }
  }

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])
  
  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [currentInput])

  // Carga (y generación la primera vez) de la escena narrativa.
  const ensureIntroduction = useCallback(async () => {
    if (introduction || loadingIntroduction) return
    setLoadingIntroduction(true)
    setIntroductionError(null)
    try {
      const res = await fetch(`/api/missions/${mission.id}/introduction`)
      if (!res.ok) throw new Error(res.status === 503 ? 'Servicio de IA no configurado' : `Error ${res.status}`)
      const data = await readJson<{ introduction: MissionIntroduction }>(res)
      if (!data?.introduction) throw new Error('La escena llegó vacía')
      setIntroduction(data.introduction)
    } catch (err) {
      setIntroductionError((err as Error).message)
    } finally {
      setLoadingIntroduction(false)
    }
  }, [introduction, loadingIntroduction, mission.id])

  // Al entrar en la escena se pide (y la primera vez se genera) la introducción.
  useEffect(() => {
    if (state === 'introduction' && !introduction && !loadingIntroduction && !introductionError) {
      void ensureIntroduction()
    }
  }, [state, introduction, loadingIntroduction, introductionError, ensureIntroduction])


  const handleKeyDown = (e: React.KeyboardEvent) => { 
      if (e.key === 'Enter' && !e.shiftKey) { 
          e.preventDefault(); 
          handleSendMessage() 
      } 
  }

  // ── Fase 2: escena narrativa ──────────────────────────────────────────
  if (state === 'introduction') {
    if (loadingIntroduction) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-slate-950 p-6">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 border-2 border-cyan/20 rounded-full animate-ping" />
            <div className="absolute inset-0 border-2 border-t-cyan border-r-transparent border-b-cyan/50 border-l-transparent rounded-full animate-spin" />
          </div>
          <p className="text-cyan font-body text-sm font-bold uppercase tracking-[0.25em] animate-pulse">
            Preparando la escena
          </p>
          <p className="text-[11px] text-slate-400 font-body text-center max-w-xs">
            Es la primera vez que se abre esta misión, así que el coach está escribiendo la conversación de ejemplo.
          </p>
        </div>
      )
    }

    if (introductionError || !introduction) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center">
          <p className="text-coral font-bold">No se pudo cargar la escena</p>
          <p className="text-xs text-slate-400 max-w-xs">{introductionError ?? 'Respuesta vacía'}</p>
          <div className="flex gap-2">
            <button
              onClick={() => { setIntroductionError(null); void ensureIntroduction() }}
              className="px-4 py-2 rounded-lg bg-cyan text-black text-xs font-bold uppercase tracking-widest"
            >
              Reintentar
            </button>
            <button
              onClick={() => setState('vocabulary')}
              className="px-4 py-2 rounded-lg border border-white/15 text-slate-300 text-xs uppercase tracking-widest"
            >
              Continuar sin escena
            </button>
          </div>
        </div>
      )
    }

    return (
      <IntroductionPlayer
        introduction={introduction}
        cefrLevel={mission.cefr_level}
        onFinish={() => setState('vocabulary')}
        onSkip={() => setState('vocabulary')}
      />
    )
  }

  // ── Fase 3: vocabulario clave (7 palabras de la escena) ──────────────
  if (state === 'vocabulary') {
    return (
      <VocabularyQuiz
        missionId={mission.id}
        cefrLevel={mission.cefr_level}
        onFinish={() => setState('preparation')}
      />
    )
  }

  // ── Fase 4: preparación ──────────────────────────────────────────────
  if (state === 'preparation') {
    const aiCharacter = introduction?.characters.find(character => character.played_by === 'ai')
    const studentCharacter = introduction?.characters.find(character => character.played_by === 'student')
    const expressions = introduction?.useful_expressions ?? []

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-slate-950 font-body">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(8,51,68,0.5)_0%,rgba(2,6,23,0.95)_100%)]" />

        <div className="relative z-10 w-full max-w-3xl space-y-5">
          <div className="text-center space-y-1">
            <span className="text-[10px] text-cyan uppercase tracking-[0.25em]">Preparación</span>
            <h1 className="font-body text-3xl font-bold text-white uppercase tracking-tight">{mission.title}</h1>
            <p className="text-[11px] text-slate-500 font-mono uppercase tracking-widest">
              Nivel {mission.cefr_level} · {Math.round((mission.base_duration_seconds ?? 120) / 60)} min
            </p>
          </div>

          {/* Situación */}
          <div className="bg-slate-900/85 border border-white/10 rounded-xl p-4 border-l-2 border-cyan/40">
            <p className="text-[11px] text-cyan uppercase tracking-widest mb-1">La situación</p>
            <p className="text-[14px] text-slate-300 leading-relaxed">
              {introduction?.scene_description ?? mission.scene_context}
            </p>
          </div>

          {/* Con quién hablas y tu papel */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="bg-slate-900/85 border border-cyan/25 rounded-xl p-4 flex items-center gap-3">
              <div>
                <p className="text-[10px] text-cyan uppercase tracking-widest">Vas a hablar con</p>
                <p className="text-sm font-bold text-white">{aiCharacter?.name ?? mission.character_name}</p>
                <p className="text-[11px] text-slate-400">{aiCharacter?.role ?? 'Lo interpreta la IA'}</p>
              </div>
            </div>
            <div className="bg-slate-900/85 border border-emerald/25 rounded-xl p-4 flex items-center gap-3">
              <div>
                <p className="text-[10px] text-emerald uppercase tracking-widest">Tu papel</p>
                <p className="text-sm font-bold text-white">{studentCharacter?.name ?? 'Tú'}</p>
                <p className="text-[11px] text-slate-400">{studentCharacter?.role ?? 'Responde con tus propias palabras'}</p>
              </div>
            </div>
          </div>

          {/* Objetivo */}
          <div className="bg-cyan/10 border border-cyan/30 rounded-xl p-4">
            <p className="text-[11px] text-cyan uppercase tracking-widest mb-1">🎯 Tu objetivo</p>
            <p className="text-[14px] text-cyan-50 leading-relaxed">{mission.objective}</p>
          </div>

          {/* Expresiones útiles */}
          {expressions.length > 0 && (
            <div className="bg-slate-900/85 border border-slate-800 rounded-xl p-4">
              <p className="text-[11px] text-emerald uppercase tracking-widest mb-2">Expresiones que te servirán</p>
              <ul className="grid sm:grid-cols-2 gap-2">
                {expressions.map((expression, index) => (
                  <li key={index} className="text-[14px] text-emerald-50/85 border-l border-emerald/25 pl-2">
                    {expression}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-slate-500 mt-3">
                Son una orientación, no un guion: responde con tu propio inglés.
              </p>
            </div>
          )}

          {/* Acciones */}
          <div className="space-y-3 pt-2">
            <div className="grid sm:grid-cols-2 gap-3">
              <button
                onClick={() => startMission('free')}
                disabled={isThinking}
                className="py-4 rounded-xl bg-slate-900/95 border border-slate-700 hover:border-cyan text-cyan font-bold uppercase tracking-widest transition-all disabled:opacity-50"
              >
                Realizar misión
                <span className="block text-[10px] text-slate-400 font-normal mt-1">Tiempo ilimitado</span>
              </button>
              <button
                onClick={() => startMission('evaluation')}
                disabled={isThinking}
                className="py-4 rounded-xl bg-slate-900/95 border border-amber/40 hover:border-amber hover:bg-amber/10 text-amber font-bold uppercase tracking-widest transition-all disabled:opacity-50"
              >
                Desafío
                <span className="block text-[10px] text-slate-400 font-normal mt-1">Tres corazones · tiempo ajustado</span>
              </button>
            </div>

            {introduction && (
              <div className="flex justify-center text-[11px] font-mono uppercase tracking-widest">
                <button onClick={() => setState('introduction')} className="text-slate-400 hover:text-cyan">
                  ↻ Repetir escena
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const usedPhrases = messages.filter(message => message.role === 'user')

  return (
    <div className="h-screen flex flex-col w-full px-4 pt-4 pb-4 relative overflow-hidden">
      {/* Fondo ambientado de la misión, tenue: el chat manda. */}
      <MissionBackdrop
        backdrop={resolveBackdrop(mission.backdrop, `${mission.title} ${mission.scene_context}`)}
        seed={mission.id}
        variant="scene"
        className="opacity-30"
      />
      <div className="absolute inset-0 bg-slate-950/50" />
      <div className="relative z-10 grid flex-1 min-h-0 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 lg:gap-6">
        {/* Columna izquierda: chat de la misión */}
        <div className="flex flex-col min-h-0">
      <div className="px-4 shrink-0 space-y-2">
        <div className="flex items-center gap-3 py-2">
          <button onClick={() => navigate(-1)} className="text-slate-light hover:text-foreground transition-colors">←</button>
          <div className="flex-1 text-center font-body text-cyan text-xs uppercase tracking-widest">{mission.title}</div>
          <div className="flex gap-2 items-center">
            <XpBar progress={progress} className="hidden sm:flex" />
            <button onClick={handleCompleteMission} className="text-xs text-emerald hover:text-emerald-400 border border-emerald/50 px-2 py-1 rounded bg-emerald/10 uppercase tracking-wide">
               Complete
            </button>
          </div>
        </div>
        
        {/* Mission Objective Card */}
        <div className="bg-gradient-to-r from-cyan-950/40 to-slate-900/40 p-3 rounded-lg border border-cyan/30 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[0.7rem] md:text-[0.75rem] text-cyan-300 font-bold uppercase tracking-widest">🎯 Objetivo</span>
            {missionMode === 'evaluation' && (
              <Timer key={timerKey} durationSeconds={timerDuration} onTimeout={() => setTimedOut(true)} />
            )}
          </div>
          <p className="text-[0.8rem] md:text-sm text-cyan-50 leading-snug line-clamp-3">{mission.objective}</p>
        </div>
        
        {/* Mission Progress Bar & Status */}
        <div className="relative pt-1">
            <div className="flex justify-between items-center mb-2">
                <span className="text-[0.7rem] md:text-[0.75rem] text-slate-400 font-body uppercase tracking-widest">
                    Progreso
                </span>
                <span className={cn(
                    "text-[0.8rem] md:text-sm font-bold font-body",
                    missionProgress >= 100 ? "text-emerald animate-pulse" : "text-cyan"
                )}>
                    {missionProgress}%
                </span>
            </div>
            <div className="overflow-hidden h-2 md:h-2.5 mb-2 text-xs flex rounded bg-slate-800 border border-slate-700/50">
                <div 
                    style={{ width: `${missionProgress}%` }}
                    className={cn(
                        "shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-700 ease-out",
                        missionProgress >= 100 ? "bg-emerald shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-cyan shadow-[0_0_5px_rgba(6,182,212,0.5)]"
                    )}
                ></div>
            </div>
            {missionMode === 'evaluation' && <HeartMeter hearts={hearts} total={TOTAL_HEARTS} />}
        </div>
      </div>

      {/* Chat Area */}
      <div className="mission-screen-messages px-4 py-2 space-y-4 scrollbar-hide" ref={scrollRef}>
          {/* Messages */}
          {messages.map((msg, i) => {
              const isUser = msg.role === 'user'
              const isLastMessage = i === messages.length - 1
              const isLastAssistantMessageTyping = isLastMessage && !isUser && isLastMessageTyping
              
              return (
                  <div key={i} className={cn("flex gap-2 mb-4", isUser ? "flex-row-reverse items-end" : "items-end")}>
                      {!isUser && <ChatAvatar name={mission.character_name} />}
                      <div className="flex flex-col gap-1">
                          <span className={cn("text-[9px] uppercase tracking-wider opacity-60", isUser ? "text-emerald text-right" : "text-cyan")}>
                              {isUser ? 'YOU' : mission.character_name}
                              {isUser && msg.rating && (
                                  <span className="text-amber-400 ml-2">{'★'.repeat(msg.rating)}</span>
                              )}
                          </span>
                          <div className={cn(
                              "max-w-[85%] p-3 text-sm leading-relaxed rounded-2xl",
                              isUser 
                                ? "bg-emerald/10 border border-emerald/20 text-emerald-50 rounded-tr-none shadow-[0_0_10px_-5px_rgba(16,185,129,0.2)]" 
                                : "bg-cyan/10 border border-cyan/20 text-cyan-50 rounded-tl-none shadow-[0_0_10px_-5px_rgba(6,182,212,0.2)]"
                          )}>
                              {isUser ? (
                                  msg.content
                              ) : msg.role === 'system' ? (
                                  msg.content
                              ) : isLastAssistantMessageTyping ? (
                                  <TypewriterMessage
                                      text={msg.content}
                                      isActive
                                      speed={30}
                                      onComplete={() => setIsLastMessageTyping(false)}
                                  />
                              ) : (
                                  <InteractiveWords text={msg.content} context={msg.content} />
                              )}
                          </div>

                          {/* Coach Feedback for this turn - moved to bottom of user message */}
                          {isUser && msg.feedback && (
                             <div className="mt-1 mr-1 max-w-full text-right flex flex-col items-end gap-1 animate-in fade-in slide-in-from-top-1">
                            <div className="text-[10px] uppercase font-bold text-amber tracking-widest flex items-center gap-1">
                                <span>AI Coach</span>
                            </div>
                            <div className="text-xs text-amber/80 bg-amber/5 px-3 py-2 rounded-lg rounded-tr-none border border-amber/10 backdrop-blur-sm">
                                {msg.feedback}
                            </div>
                         </div>
                          )}
                      </div>
                  </div>
              )
          })}
          
          {isThinking && (
              <div className="flex gap-2 items-end animate-pulse">
                  <ChatAvatar name={mission.character_name} />
                  <div className="flex flex-col gap-1">
                      <span className="text-[9px] uppercase tracking-wider opacity-60 text-cyan">{mission.character_name}</span>
                      <div className="bg-cyan/5 border border-cyan/10 text-cyan px-3 py-2 rounded-2xl rounded-tl-none text-xs">
                          escribiendo…
                      </div>
                  </div>
              </div>
          )}
      </div>

      {/* Input Area */}
      <div className="mission-screen-input px-4 pt-2">
        <div className={cn('relative rounded-xl border transition-all duration-200 bg-white/5 border-white/10 flex items-end gap-2 p-2', currentInput.trim() && 'border-cyan/40 bg-cyan/5')}>
          <textarea 
             ref={textareaRef} 
             value={currentInput} 
             onChange={e => setCurrentInput(e.target.value)} 
             onKeyDown={handleKeyDown} 
             placeholder={timedOut ? "Mission time ended. Finish up!" : "Type your message..."}
             disabled={state === 'submitting' || isThinking} 
             rows={1} 
             className="flex-1 bg-transparent resize-none p-2 text-foreground placeholder:text-slate/40 focus:outline-none font-body text-sm leading-relaxed disabled:opacity-50 max-h-32" 
          />
          <button 
             onClick={handleSendMessage} 
             disabled={!currentInput.trim() || state === 'submitting' || isThinking} 
             className={cn('p-2 rounded-lg transition-all duration-200 active:scale-95 shrink-0', currentInput.trim() ? 'bg-cyan text-black hover:bg-cyan-400' : 'bg-white/10 text-slate-500 cursor-not-allowed')}
          >
             <span className="text-xs font-bold uppercase">Send</span>
          </button>
        </div>
        <p className="text-center text-[10px] text-slate/30 mt-2 font-body pb-safe">Enter to send • Shift+Enter for new line</p>
        </div>
      </div>

      {/* Columna derecha: registro de frases y correcciones (sólo escritorio;
          en móvil se oculta para dejar todo el ancho al chat) */}
      <aside className="hidden lg:block lg:min-h-0">
        <ConversationLog entries={usedPhrases} />
      </aside>
      </div>

      {/* Generando el reporte: la evaluación tarda unos segundos */}
      {state === 'submitting' && (
        <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-6 bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-2 border-cyan/20 rounded-full animate-ping" />
            <div className="absolute inset-0 border-2 border-t-cyan border-r-transparent border-b-cyan/50 border-l-transparent rounded-full animate-spin" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-cyan font-body text-sm font-bold uppercase tracking-[0.25em] animate-pulse">
              Generando tu reporte
            </p>
            <p className="text-[11px] text-slate-400 font-body">
              Evaluando tus frases con el coach… esto tarda unos segundos
            </p>
          </div>
        </div>
      )}

      {/* Misión completada: aviso sobrio que se revela en cadena */}
      {showCompletionNotification && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-1000">
          <div className="relative z-10 w-full max-w-md px-8 text-center">
            {/* Titular que se escribe letra a letra; al terminar encadena el resto */}
            <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white">
              <TypewriterMessage
                text="Misión completada"
                isActive
                speed={75}
                onComplete={() => setCompletionTyped(true)}
              />
            </h2>

            {completionTyped && (
              <div className="animate-in fade-in duration-700">
                <div className="mx-auto mt-8 h-px w-12 bg-cyan/40" />
                <p className="mt-8 text-[11px] font-mono uppercase tracking-[0.3em] text-cyan-200/70">
                  Objetivos al 100 %
                </p>
              </div>
            )}

            {completionActions && (
              <div className="mt-12 flex flex-col gap-3 animate-in fade-in duration-700">
                <button
                  onClick={handleCompleteMission}
                  className="w-full rounded-xl bg-white py-3.5 text-sm font-bold uppercase tracking-widest text-cyan-950 transition-colors hover:bg-cyan-50 active:scale-[0.99]"
                >
                  Enviar informe
                </button>
                <button
                  onClick={() => setShowCompletionNotification(false)}
                  className="w-full rounded-xl py-3 text-[11px] font-mono uppercase tracking-widest text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                >
                  Seguir en la simulación
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Desafío fallido: sin corazones */}
      {showFailedNotification && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-red-950/90 backdrop-blur-md animate-in fade-in duration-500">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,red_20deg,transparent_40deg)] opacity-10 animate-[spin_8s_linear_infinite]" />
          </div>

          <div className="relative z-10 text-center space-y-6 p-8 max-w-md w-full">
            <div className="mx-auto w-24 h-24 bg-red-400/15 rounded-full flex items-center justify-center border-2 border-red-400 shadow-[0_0_30px_rgba(248,113,113,0.4)]">
              <span className="text-5xl">💔</span>
            </div>

            <div className="space-y-2">
              <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-red-200 uppercase tracking-tighter drop-shadow-lg">
                Desafío<br/>Fallido
              </h2>
              <p className="text-red-200 font-body text-sm tracking-[0.2em] animate-pulse">
                TE QUEDASTE SIN CORAZONES
              </p>
            </div>

            <p className="text-red-100/80 text-base font-light leading-relaxed max-w-xs mx-auto">
              Repasa las correcciones de la lista de la derecha y vuelve a intentarlo: en el Desafío cada frase fuera de tema o mal escrita cuesta un corazón.
            </p>

            <div className="flex flex-col gap-3 w-full pt-2">
              <button
                onClick={() => { setState('preparation'); setShowFailedNotification(false); setMissionProgress(0); setHearts(TOTAL_HEARTS) }}
                className="w-full py-4 rounded-xl bg-white text-red-900 font-black text-lg uppercase tracking-wider shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105 transition-all active:scale-95"
              >
                Reintentar
              </button>
              <button
                onClick={() => setShowFailedNotification(false)}
                className="w-full py-3 text-red-200/60 font-body text-xs uppercase tracking-widest hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                [ Volver al desafío ]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notificación de corrección (esquina superior derecha) */}
      <StepHintStack hints={stepHints} onDismiss={dismissStepHint} />
      <GrammarToastStack notices={grammarNotices} onDismiss={dismissGrammarNotice} />
    </div>
  )
}
