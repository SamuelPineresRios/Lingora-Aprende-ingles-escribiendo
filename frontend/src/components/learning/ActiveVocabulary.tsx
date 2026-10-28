/**
 * Vocabulario activo: las palabras del vocabulario de tus misiones que ya
 * aparecen en lo que escribiste. Distingue lo reconocido de lo producido y
 * lista lo que queda «por activar». Vive en la página de Vocabulario.
 */
import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { readJson } from '@/lib/api'
import { useAuth } from '@/lib/hooks/useAuth'

interface ActiveVocabularyEntry {
  word: string
  translation: string
  mission_id: string
  mission_title: string
}

interface ActiveVocabularyView {
  active_count: number
  studied_total: number
  active: ActiveVocabularyEntry[]
  pending: ActiveVocabularyEntry[]
}

export function ActiveVocabulary() {
  const { user } = useAuth()
  const [view, setView] = useState<ActiveVocabularyView | null>(null)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    fetch(`/api/students/${user.id}/active-vocabulary`)
      .then(readJson<ActiveVocabularyView>)
      .then(data => {
        if (!cancelled && data) setView(data)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [user?.id])

  if (!view || view.studied_total === 0) return null

  const pct = Math.round((view.active_count / view.studied_total) * 100)

  return (
    <section className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald" />
          Vocabulario activo
        </h3>
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          {view.active_count} de {view.studied_total} palabras
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-emerald transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-slate-500">
        Palabras del vocabulario de tus misiones que ya usaste al escribir. Cuantas más uses, más crece.
      </p>

      {view.active.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {view.active.map(entry => (
            <span
              key={`${entry.mission_id}-${entry.word}`}
              title={`${entry.translation} · ${entry.mission_title}`}
              className="rounded-full border border-emerald/40 bg-emerald/10 px-2.5 py-1 text-[11px] text-emerald-200"
            >
              {entry.word}
            </span>
          ))}
        </div>
      )}

      {view.pending.length > 0 && (
        <div className="space-y-1.5 border-t border-white/10 pt-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-600">Por activar</p>
          <div className="flex flex-wrap gap-1.5">
            {view.pending.map(entry => (
              <span
                key={`${entry.mission_id}-${entry.word}`}
                title={`${entry.translation} · ${entry.mission_title}`}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-400"
              >
                {entry.word}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
