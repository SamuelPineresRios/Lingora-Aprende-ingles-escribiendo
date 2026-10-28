/**
 * Errores: el historial de correcciones estructuradas de tus misiones.
 *
 * Cada evaluación con mejoras guarda la frase original, la versión correcta
 * y el porqué. Aquí se listan por misión y fecha para repasar qué falló y
 * cómo se dice bien.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Loader2, NotebookPen } from 'lucide-react'
import { readJson } from '@/lib/api'
import { useAuth } from '@/lib/hooks/useAuth'
import { ModuleBackdrop } from '@/components/layout/ModuleBackdrop'

interface Improvement {
  original: string
  correction: string
  explanation: string
}

interface ImprovementEntry {
  evaluation_id: string
  mission_id: string
  mission_title: string
  level: string
  submitted_at: string
  comprehension: number
  grammar: number
  improvements: Improvement[]
}

interface ImprovementsView {
  items: ImprovementEntry[]
}

/** Fecha legible: «17 oct, 14:32». */
function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function MistakesPage() {
  const { user } = useAuth()
  const [view, setView] = useState<ImprovementsView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    fetch(`/api/students/${user.id}/improvements`)
      .then(readJson<ImprovementsView>)
      .then(data => {
        if (!cancelled && data) setView(data)
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id])

  const total = view?.items.reduce((sum, entry) => sum + entry.improvements.length, 0) ?? 0

  return (
    <div className="relative min-h-[100vh] w-full bg-black/90">
      <ModuleBackdrop />

      <div className="relative z-10 min-h-screen p-4 font-mono max-w-4xl mx-auto sm:p-8 space-y-8 animate-fade-in pt-16 lg:pt-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-body text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]">
              ERRORES
            </h1>
            <p className="text-[11px] text-slate-500 uppercase tracking-widest mt-2">
              {view
                ? `${total} ${total === 1 ? 'corrección guardada' : 'correcciones guardadas'} · qué falló y cómo se dice bien`
                : 'Tus correcciones, con su explicación'}
            </p>
          </div>
        </header>

        {loading && (
          <div className="flex items-center justify-center py-20 text-slate-500 gap-2 text-xs uppercase tracking-widest">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        )}

        {!loading && error && <p className="text-coral text-sm">{error}</p>}

        {!loading && view && view.items.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-2xl space-y-2">
            <NotebookPen className="h-8 w-8 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-xs uppercase tracking-widest">Todavía no hay correcciones</p>
            <p className="text-[11px] text-slate-500 mx-auto max-w-sm">
              Completa una misión y aquí verás cada error con su versión correcta y la explicación.
            </p>
          </div>
        )}

        {!loading && view && view.items.length > 0 && (
          <section className="space-y-4">
            {view.items.map(entry => (
              <article key={entry.evaluation_id} className="rounded-2xl border border-white/10 bg-black/25 p-5">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 rounded border border-cyan/40 px-1.5 py-0.5 text-[10px] font-bold text-cyan">
                      {entry.level}
                    </span>
                    <Link
                      to={`/mission/${entry.mission_id}`}
                      className="truncate text-sm font-semibold text-white hover:text-cyan"
                    >
                      {entry.mission_title}
                    </Link>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-slate-500">
                    {formatDate(entry.submitted_at)} · {entry.comprehension}/{entry.grammar}
                  </span>
                </header>

                <ul className="mt-4 space-y-4">
                  {entry.improvements.map((item, index) => (
                    <li key={index} className="space-y-1">
                      {item.original ? (
                        <p className="text-[13px] leading-relaxed text-slate-400">
                          <span className="mr-2 rounded bg-coral/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-coral">
                            Dijiste
                          </span>
                          <span className="line-through decoration-coral/50">{item.original}</span>
                        </p>
                      ) : (
                        <p className="text-[13px] text-slate-500">
                          <span className="mr-2 rounded bg-emerald/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald">
                            Mejora
                          </span>
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
              </article>
            ))}
          </section>
        )}
      </div>
    </div>
  )
}
