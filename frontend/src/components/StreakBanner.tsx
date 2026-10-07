/**
 * Aviso de racha: en riesgo (aún no practica hoy) o rota con escudos para
 * salvarla. Va en Misiones, lo primero que se ve.
 */
import { useState } from 'react'
import { Flame, Shield } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useProgress } from '@/lib/hooks/useProgress'

export function StreakBanner() {
  const { user } = useAuth()
  const { progress, refresh } = useProgress(user?.id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!progress) return null

  const usarEscudo = async () => {
    if (!user?.id || busy) return
    setBusy(true)
    setError('')
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      const res = await fetch(`/api/students/${user.id}/streak/use-shield?tz=${encodeURIComponent(tz)}`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? 'No se pudo usar el escudo.')
      }
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo usar el escudo.')
    } finally {
      setBusy(false)
    }
  }

  const rota = progress.streak_broken && progress.streak_shields > 0
  if (!rota && !progress.streak_at_risk) return null

  return (
    <section
      className={
        rota
          ? 'flex flex-wrap items-center gap-3 rounded-2xl border border-amber/40 bg-amber/10 px-5 py-4'
          : 'flex flex-wrap items-center gap-3 rounded-2xl border border-amber/30 bg-amber/5 px-5 py-4'
      }
    >
      <Flame className="h-5 w-5 shrink-0 text-amber" />
      <p className="min-w-0 flex-1 text-sm text-white">
        {rota ? (
          <>
            Tu racha se rompió.{' '}
            <span className="text-slate-400">
              Tienes {progress.streak_shields} {progress.streak_shields === 1 ? 'escudo' : 'escudos'}: úsalo para
              reconectarla.
            </span>
          </>
        ) : (
          <>
            Tu racha de {progress.streak} {progress.streak === 1 ? 'día' : 'días'} está en riesgo.{' '}
            <span className="text-slate-400">Completa una misión hoy para mantenerla.</span>
          </>
        )}
      </p>

      {rota && (
        <button
          onClick={usarEscudo}
          disabled={busy}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-amber px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-black transition-colors hover:bg-amber-light disabled:opacity-50"
        >
          <Shield className="h-3.5 w-3.5" /> Usar escudo
        </button>
      )}

      {error && <p className="w-full text-xs text-coral">{error}</p>}
    </section>
  )
}
