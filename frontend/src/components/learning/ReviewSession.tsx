/**
 * Repaso de hoy: las palabras guardadas que tocan según el SRS.
 *
 * El ejercicio es una frase con la palabra en blanco y cuatro opciones sacadas
 * del propio vocabulario del alumno; la corrección y el calendario los lleva
 * el backend. Va en Misiones, después de los retos.
 */
import { useEffect, useState } from 'react'
import { Brain, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { readJson } from '@/lib/api'
import { useAuth } from '@/lib/hooks/useAuth'

interface ReviewItem {
  saved_id: string
  prompt: string
  options: string[]
}

interface ReviewResult {
  correct: boolean
  answer: string
  translation: string
  due: number
}

export function ReviewSession() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [due, setDue] = useState(0)
  const [items, setItems] = useState<ReviewItem[]>([])
  const [reviewing, setReviewing] = useState(false)
  const [index, setIndex] = useState(0)
  const [feedback, setFeedback] = useState<ReviewResult | null>(null)
  const [aciertos, setAciertos] = useState(0)
  const [respondidas, setRespondidas] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    fetch(`/api/students/${user.id}/reviews?limit=5`)
      .then(readJson<{ due: number; items: ReviewItem[] }>)
      .then(data => {
        if (cancelled || !data) return
        setDue(data.due)
        setItems(data.items)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id])

  const item = items[index]

  const responder = async (option: string) => {
    if (!user?.id || !item || feedback) return
    setError('')
    try {
      const res = await fetch(`/api/students/${user.id}/reviews/${item.saved_id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ option }),
      })
      const data = await readJson<ReviewResult & { error?: string }>(res)
      if (!res.ok || !data) throw new Error(data?.error ?? 'No se pudo corregir.')

      setFeedback(data)
      setDue(data.due)
      setRespondidas(value => value + 1)
      if (data.correct) setAciertos(value => value + 1)

      // Deja ver la corrección y pasa a la siguiente.
      setTimeout(() => {
        setFeedback(null)
        if (index + 1 < items.length) setIndex(value => value + 1)
        else setReviewing(false)
      }, 1400)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo corregir.')
    }
  }

  if (loading) return null

  return (
    <section className="rounded-2xl border border-white/10 bg-black/30 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-300">
          <Brain className="h-4 w-4 text-violet" /> Repaso de hoy
        </h2>
        {!reviewing && (
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            {due === 0 ? 'Al día' : `${due} ${due === 1 ? 'palabra' : 'palabras'} por repasar`}
          </span>
        )}
      </div>

      {!reviewing && due === 0 && (
        <p className="text-[11px] text-slate-500">
          No tienes palabras pendientes. Las que guardes vuelven mañana, a los 3, 7 y 21 días.
        </p>
      )}

      {!reviewing && due > 0 && (
        <button
          onClick={() => {
            setReviewing(true)
            setIndex(0)
            setAciertos(0)
            setRespondidas(0)
          }}
          className="w-full rounded-xl bg-violet py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-violet-400"
        >
          Repasar {items.length} {items.length === 1 ? 'palabra' : 'palabras'}
        </button>
      )}

      {reviewing && item && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
              {index + 1} de {items.length}
            </p>
            <button
              onClick={() => setReviewing(false)}
              className="text-slate-500 transition-colors hover:text-white"
              aria-label="Cerrar el repaso"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="font-reading text-lg leading-relaxed text-white">{item.prompt}</p>

          <div className="grid gap-2 sm:grid-cols-2">
            {item.options.map(option => {
              const revelada = feedback && option.toLowerCase() === feedback.answer.toLowerCase()
              const fallada =
                feedback && !feedback.correct && option.toLowerCase() === feedback.answer.toLowerCase()
              return (
                <button
                  key={option}
                  onClick={() => responder(option)}
                  disabled={Boolean(feedback)}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-left text-sm transition-colors',
                    revelada && 'border-emerald/60 bg-emerald/10 text-emerald',
                    fallada && 'border-emerald/60 bg-emerald/10 text-emerald',
                    !feedback && 'border-white/10 bg-white/5 text-slate-200 hover:border-violet/50',
                    feedback && !revelada && 'border-white/5 text-slate-500 opacity-50',
                  )}
                >
                  {option}
                </button>
              )
            })}
          </div>

          {feedback && (
            <p
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
                feedback.correct
                  ? 'border-emerald/40 bg-emerald/10 text-emerald'
                  : 'border-coral/40 bg-coral/10 text-red-100',
              )}
            >
              {feedback.correct ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              {feedback.correct
                ? '¡Bien!'
                : `Era «${feedback.answer}» (${feedback.translation}). Volverá mañana.`}
            </p>
          )}
        </div>
      )}

      {!reviewing && respondidas > 0 && (
        <p className="text-[11px] text-slate-400">
          Repasadas {respondidas} · {aciertos} {aciertos === 1 ? 'acierto' : 'aciertos'}
          {due > 0 ? ` · quedan ${due}` : ' · todo al día'}
        </p>
      )}

      {error && <p className="text-coral text-xs">{error}</p>}
    </section>
  )
}
