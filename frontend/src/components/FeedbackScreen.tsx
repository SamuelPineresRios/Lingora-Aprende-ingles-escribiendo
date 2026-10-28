import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/hooks/useAuth'
import { useProgress } from '@/lib/hooks/useProgress'

interface EvaluationPayload {
  comprehensibility_score: number
  grammar_score: number
  lexical_richness_score: number
  judgment: 'ADVANCE' | 'PAUSE'
  feedback_text: string
  detected_structures: string[]
  /** Mejoras estructuradas: frase original, corrección y explicación. */
  improvements?: Array<{ original: string; correction: string; explanation: string }>
  /** XP que otorgó este envío (0 si fue rechazado). */
  xp_awarded: number | null
}

interface FeedbackScreenProps {
  evaluation: EvaluationPayload
  missionTitle: string
  /** Lo dice la conversación, no el evaluador: completar el objetivo es lo que cuenta. */
  missionCompleted: boolean
  /** Cómo se jugó: la práctica libre no da XP y ofrece el Desafío. */
  mode?: 'free' | 'evaluation'
  missionId?: string
  onTryAgain?: () => void
  onNextMission?: () => void
}

/** Título de sección minimalista: rótulo, línea y nada más. */
function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{children}</h2>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  )
}

/**
 * Convierte el bloque de mejoras en una lista de ideas.
 *
 * El modelo las manda en líneas con "- "; los informes antiguos traían un
 * párrafo corrido, así que en ese caso se corta por frases.
 */
function improvementItems(text: string): string[] {
  const clean = text.replace(/(CONTEXT|ACHIEVEMENT|IMPROVEMENT):/i, '').trim()

  const lines = clean
    .split('\n')
    .map(line => line.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
  if (lines.length > 1) return lines

  return clean
    .split(/(?<=[.!?])\s+(?=[¿¡"A-ZÁÉÍÓÚÑ])/)
    .map(sentence => sentence.trim())
    .filter(Boolean)
}

/** Rótulo en español de cada bloque del análisis. */
const PART_LABELS: Record<'context' | 'strength' | 'improvement', string> = {
  context: 'Contexto',
  strength: 'Lo que hiciste bien',
  improvement: 'A mejorar',
}

const PART_COLORS: Record<'context' | 'strength' | 'improvement', string> = {
  context: 'bg-blue-400',
  strength: 'bg-emerald',
  improvement: 'bg-amber',
}

export function FeedbackScreen({
  evaluation,
  missionTitle,
  missionCompleted,
  mode = 'evaluation',
  missionId,
  onTryAgain,
  onNextMission,
}: FeedbackScreenProps) {
  const [visible, setVisible] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { progress } = useProgress(user?.id)
  const isAdvance = missionCompleted
  const xp = evaluation.xp_awarded ?? 0
  // Si el XP ganado supera lo que había dentro del nivel, es que subió.
  const leveledUp = Boolean(progress && xp > progress.level_xp)
  const xpPercent = progress && progress.level_span > 0
    ? Math.round((progress.level_xp / progress.level_span) * 100)
    : 0

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const rawParts = evaluation.feedback_text.split('\n\n').filter(Boolean)
  // Si hay mejoras estructuradas pero el texto no trae la tercera parte, se
  // añade una vacía para que el bloque «A mejorar» las pinte igualmente.
  const feedbackParts =
    evaluation.improvements?.length && rawParts.length < 3 ? [...rawParts, ''] : rawParts

  const metrics = [
    { label: 'Comunicación', score: evaluation.comprehensibility_score, stroke: 'stroke-cyan' },
    { label: 'Gramática', score: evaluation.grammar_score, stroke: 'stroke-violet' },
    { label: 'Vocabulario', score: evaluation.lexical_richness_score, stroke: 'stroke-amber' },
  ]

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/95 font-mono text-slate-200 backdrop-blur-sm">
      <div
        className={cn(
          'mx-auto w-full max-w-lg px-6 py-12 transition-all duration-700 ease-out',
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        )}
      >
        {/* Cabecera: estado y misión */}
        <header className="text-center space-y-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Informe de la misión</p>
          <div
            className={cn(
              'inline-flex items-center rounded-full border px-3 py-1 text-[11px] uppercase tracking-widest',
              isAdvance
                ? 'border-emerald/40 bg-emerald/10 text-emerald'
                : 'border-amber/40 bg-amber/10 text-amber',
            )}
          >
            {isAdvance ? 'Misión completada' : 'Objetivo no alcanzado'}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">{missionTitle}</h1>
        </header>

        {user?.is_guest && (
          <section className="mt-8 rounded-2xl border border-amber/40 bg-amber/10 p-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber">¿Te gustó la misión?</p>
            <p className="mt-2 text-sm leading-relaxed text-white">
              Crea tu cuenta gratis para conservar este progreso, <span className="font-bold text-amber">generar XP</span> y
              subir de nivel.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link
                to="/signup"
                className="rounded-xl bg-amber px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-950 transition-colors hover:bg-amber-300"
              >
                Crear mi cuenta
              </Link>
              <Link
                to="/login"
                className="rounded-xl border border-white/15 px-4 py-3 text-[10px] uppercase tracking-widest text-slate-300 transition-colors hover:border-white/30"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </section>
        )}

        {/* Puntuaciones */}
        <section className="mt-10">
          <SectionTitle>Resultados</SectionTitle>
          <div className="grid grid-cols-3 gap-3">
            {metrics.map(metric => (
              <div
                key={metric.label}
                className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="relative flex h-14 w-14 items-center justify-center">
                  <svg className="h-full w-full -rotate-90">
                    <circle cx="28" cy="28" r="24" className="stroke-white/10" strokeWidth="3" fill="none" />
                    <circle
                      cx="28"
                      cy="28"
                      r="24"
                      className={cn('transition-all duration-1000 ease-out', metric.stroke)}
                      strokeWidth="3"
                      fill="none"
                      strokeDasharray={151}
                      strokeDashoffset={visible ? 151 - (151 * metric.score) / 100 : 151}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-sm font-bold text-white">{metric.score}</span>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400">{metric.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Análisis del evaluador */}
        {feedbackParts.length > 0 && (
          <section className="mt-10">
            <SectionTitle>Análisis</SectionTitle>
            <div className="space-y-3">
              {feedbackParts.map((part, index) => {
                // La API devuelve contexto, logro y mejora en ese orden.
                const type = index === 0 ? 'context' : index === 1 ? 'strength' : 'improvement'

                return (
                  <div
                    key={index}
                    className={cn(
                      'relative rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-all duration-500',
                      visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3',
                    )}
                    style={{ transitionDelay: `${index * 120}ms` }}
                  >
                    <span className={cn('absolute left-0 top-3 bottom-3 w-0.5 rounded-full', PART_COLORS[type])} />
                    <p className="mb-1 text-[10px] uppercase tracking-widest text-slate-500">{PART_LABELS[type]}</p>
                    {type === 'improvement' && evaluation.improvements && evaluation.improvements.length > 0 ? (
                      <ul className="space-y-3">
                        {evaluation.improvements.map((item, itemIndex) => (
                          <li key={itemIndex} className="space-y-1">
                            {item.original && (
                              <p className="text-[12px] leading-relaxed text-slate-400">
                                <span className="mr-1.5 font-bold uppercase tracking-widest text-coral">Dijiste:</span>
                                <span className="line-through decoration-coral/50">{item.original}</span>
                              </p>
                            )}
                            <p className="flex items-start gap-2 text-[13px] leading-relaxed text-emerald-200">
                              <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald" />
                              {item.correction}
                            </p>
                            <p className="pl-[22px] text-[12px] leading-relaxed text-slate-500">{item.explanation}</p>
                          </li>
                        ))}
                      </ul>
                    ) : type === 'improvement' ? (
                      <ul className="space-y-1.5">
                        {improvementItems(part).map((item, itemIndex) => (
                          <li key={itemIndex} className="flex gap-2 text-[13px] leading-relaxed text-slate-200">
                            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-amber" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[13px] leading-relaxed text-slate-200">
                        {part.replace(/(CONTEXT|ACHIEVEMENT|IMPROVEMENT):/i, '').trim()}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Experiencia ganada */}
        {xp > 0 && (
          <section className="mt-10">
            <SectionTitle>Experiencia</SectionTitle>
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-xl font-bold text-cyan">+{xp} XP</p>
                {progress && (
                  <p className="font-mono text-xs text-slate-400">
                    Nivel {progress.level} · {progress.total_xp} XP
                  </p>
                )}
              </div>
              {leveledUp && (
                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald">¡Nuevo nivel!</p>
              )}
              {progress && (
                <>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-cyan transition-all duration-700"
                      style={{ width: `${xpPercent}%` }}
                    />
                  </div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">
                    {progress.xp_to_next === 0
                      ? 'Nivel completo'
                      : `Faltan ${progress.xp_to_next} XP para el nivel ${progress.level + 1}`}
                  </p>
                </>
              )}
            </div>
          </section>
        )}

        {/* ¿Deseas desafiar? Tras la práctica libre, aquí sí se gana XP. */}
        {mode === 'free' && missionCompleted && missionId && (
          <section className="mt-10">
            <SectionTitle>Desafío</SectionTitle>
            <div className="space-y-3 rounded-xl border border-amber/40 bg-amber/10 p-4">
              <p className="text-[12px] leading-relaxed text-slate-300">
                En <span className="text-white">Tiempo ilimitado</span> no se gana XP. En el Desafío sí:
                3 corazones, un minuto por respuesta y sin traducciones ni pistas.
              </p>
              <button
                onClick={() => navigate(`/mission/${missionId}?desafio=1`)}
                className="w-full rounded-xl bg-amber py-3 text-[11px] font-bold uppercase tracking-widest text-black transition-colors hover:bg-amber-light"
              >
                ¿Deseas desafiar?
              </button>
            </div>
          </section>
        )}

        {/* Acciones */}
        <div className="mt-10 flex flex-col gap-3 pb-8">
          {isAdvance ? (
            <button
              onClick={onNextMission ?? (() => navigate('/missions'))}
              className="w-full rounded-xl bg-cyan py-3.5 text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-cyan-400 active:scale-[0.99]"
            >
              Siguiente misión
            </button>
          ) : (
            <button
              onClick={onTryAgain}
              className="w-full rounded-xl bg-amber py-3.5 text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-amber-light active:scale-[0.99]"
            >
              Reintentar la misión
            </button>
          )}
          <button
            onClick={() => navigate('/mistakes')}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-coral/30 py-3 text-[11px] uppercase tracking-widest text-coral transition-colors hover:bg-coral/10"
          >
            Ver historial de errores <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => navigate('/missions')}
            className="w-full rounded-xl border border-white/10 py-3 text-[11px] uppercase tracking-widest text-slate-400 transition-colors hover:border-white/25 hover:text-white"
          >
            Volver a misiones
          </button>
        </div>
      </div>
    </div>
  )
}
