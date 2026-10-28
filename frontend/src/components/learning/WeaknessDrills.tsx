/**
 * Puntos débiles: los errores que más bloquean al alumno y una sesión de
 * drills para practicarlos. El chat los registra al vuelo; aquí se pinta el
 * informe y se juega la sesión (evaluación local, sin llamadas extra).
 */
import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Check, Dumbbell, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { readJson } from '@/lib/api'
import { useAuth } from '@/lib/hooks/useAuth'

interface DrillExercise {
  id: string
  type: string
  prompt: string
  options: string[]
  answer: string
  translation: string
  /** Por qué esa opción es la correcta y cómo se usa la regla. */
  explanation: string
}

interface WeaknessReport {
  total_errors: number
  top: Array<{ type: string; label: string; count: number }>
  session: DrillExercise[]
}

export function WeaknessDrills() {
  const { user } = useAuth()
  const [report, setReport] = useState<WeaknessReport | null>(null)
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [choice, setChoice] = useState<string | null>(null)
  const [hits, setHits] = useState(0)

  const load = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await fetch(`/api/students/${user.id}/weaknesses`)
      const data = await readJson<WeaknessReport>(res)
      if (data) setReport(data)
    } catch {
      // Sin informe, la tarjeta no se pinta.
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  if (!report) return null

  const exercise = report.session[index]

  const start = () => {
    setIndex(0)
    setChoice(null)
    setHits(0)
    setOpen(true)
  }

  const pick = (option: string) => {
    if (choice !== null || !exercise) return
    setChoice(option)
    if (option === exercise.answer) setHits(value => value + 1)
  }

  const next = async () => {
    if (index + 1 >= report.session.length) {
      setOpen(false)
      // Nueva sesión (variada) para la próxima vez.
      await load()
      return
    }
    setIndex(value => value + 1)
    setChoice(null)
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-black/30 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-300">
          <Dumbbell className="h-4 w-4 text-coral" /> Puntos débiles
        </h2>
        {report.total_errors > 0 && (
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            {report.total_errors} {report.total_errors === 1 ? 'error registrado' : 'errores registrados'}
          </span>
        )}
      </div>

      {report.top.length === 0 ? (
        <p className="text-[11px] text-slate-500">
          Aún sin datos: cuando una regla te bloquee en una conversación, aparecerá aquí con su práctica.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {report.top.map(item => (
            <span
              key={item.type}
              className="rounded-full border border-coral/30 bg-coral/5 px-2.5 py-1 text-[10px] uppercase tracking-widest text-coral"
            >
              {item.label} ×{item.count}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={start}
        disabled={report.session.length === 0}
        className="w-full rounded-xl bg-coral py-2.5 text-[10px] font-bold uppercase tracking-widest text-black transition-colors hover:bg-coral/80 disabled:opacity-50"
      >
        {report.top.length > 0 ? 'Practicar mis puntos débiles' : 'Practicar ahora'}
      </button>

      {/* Sesión de drills */}
      {open && exercise && (
        <div data-drill-modal className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-white/10 bg-slate-950/95 p-6">
            <header className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-coral">Puntos débiles</p>
                <h3 className="text-lg font-bold text-white">
                  Ejercicio {index + 1} de {report.session.length}
                </h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 transition-colors hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-5">
              <p className="font-body text-lg leading-relaxed text-white sm:text-xl">
                {exercise.prompt.split('___').map((part, partIndex) => (
                  <span key={partIndex}>
                    {part}
                    {partIndex === 0 && exercise.prompt.includes('___') && (
                      <span
                        className={cn(
                          'mx-1 inline-block min-w-16 border-b-2 px-2 text-center font-bold',
                          choice ? 'border-emerald/60 text-emerald' : 'border-coral/50 text-coral/40',
                        )}
                      >
                        {choice ? exercise.answer : '___'}
                      </span>
                    )}
                  </span>
                ))}
              </p>
              {choice !== null && (
                <p className="mt-3 text-[13px] italic text-slate-400">{exercise.translation}</p>
              )}
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              {exercise.options.map(option => {
                const isCorrect = option === exercise.answer
                const chosen = choice === option
                return (
                  <button
                    key={option}
                    onClick={() => pick(option)}
                    disabled={choice !== null}
                    className={cn(
                      'rounded-xl border px-3 py-3 text-sm font-bold transition-all duration-200',
                      choice === null && 'border-white/10 bg-white/5 text-white hover:border-coral/40 hover:bg-coral/5 active:scale-[0.98]',
                      choice !== null && isCorrect && 'border-emerald/50 bg-emerald/10 text-emerald-200',
                      choice !== null && chosen && !isCorrect && 'border-coral/60 bg-coral/10 text-red-100',
                      choice !== null && !chosen && !isCorrect && 'border-white/10 bg-white/5 text-slate-500',
                    )}
                  >
                    {option}
                    {choice !== null && isCorrect && <Check className="ml-1.5 inline h-3.5 w-3.5" />}
                  </button>
                )
              })}
            </div>

            {choice !== null && exercise.explanation && (
              <div className="rounded-xl border border-cyan/25 bg-cyan/5 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-cyan">¿Por qué?</p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-300">{exercise.explanation}</p>
              </div>
            )}

            {choice !== null && (
              <button
                onClick={() => void next()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-coral py-3 text-[11px] font-bold uppercase tracking-widest text-black transition-colors hover:bg-coral/80"
              >
                {index + 1 >= report.session.length ? `Terminar (${hits}/${report.session.length})` : 'Siguiente'}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
