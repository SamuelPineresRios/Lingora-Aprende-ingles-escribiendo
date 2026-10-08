/**
 * Aviso de racha compacto para la cabecera de Misiones: se pone junto a
 * «Disconnect». En riesgo avisa; rota y con escudos ofrece reconectarla.
 */
import { useState } from 'react'
import { Flame, Loader2, Shield } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useProgress } from '@/lib/hooks/useProgress'

export function StreakNotice() {
  const { user } = useAuth()
  const { progress, refresh } = useProgress(user?.id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!progress) return null

  const rota = progress.streak_broken && progress.streak_shields > 0
  if (!rota && !progress.streak_at_risk) return null

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

  if (rota) {
    return (
      <button
        onClick={usarEscudo}
        disabled={busy}
        title="Tu racha se rompió: usa un escudo para reconectarla"
        className="flex items-center gap-1.5 rounded-lg border border-amber/50 bg-amber/10 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-amber transition-colors hover:bg-amber/20 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
        Usar escudo ({progress.streak_shields})
      </button>
    )
  }

  return (
    <span
      title={`Tu racha de ${progress.streak} ${progress.streak === 1 ? 'día' : 'días'} se rompe si hoy no practicas`}
      className="flex items-center gap-1.5 rounded-lg border border-amber/40 bg-amber/5 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-amber"
    >
      <Flame className="h-3.5 w-3.5" /> Tu racha está en riesgo
      {error && <span className="text-coral normal-case">· {error}</span>}
    </span>
  )
}
