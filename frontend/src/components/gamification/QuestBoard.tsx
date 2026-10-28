/**
 * Retos: los diarios (con cofre sorpresa y ruleta) y los semanales.
 *
 * El backend calcula el progreso desde la actividad real; aquí solo se pinta,
 * se reclama y se celebra el premio del cofre. `DailyQuests` va en Misiones;
 * `WeeklyQuests`, en el Pase.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Coins, Dices, Flame, Gift, Loader2, Shield, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { readJson } from '@/lib/api'
import { useAuth } from '@/lib/hooks/useAuth'

interface QuestState {
  id: string
  label: string
  description: string
  target: number
  coins: number
  progress: number
  done: boolean
  claimed: boolean
}

interface Surprise {
  mission: { id: string; title: string }
  xp_percent: number
  consumed: boolean
}

interface ChestReward {
  kind: 'coins' | 'shield'
  coins?: number
  label: string
}

interface QuestsView {
  balance: number
  day: { key: string; quests: QuestState[]; chest: { ready: boolean; claimed: boolean }; surprise: Surprise | null }
  week: { key: string; quests: QuestState[] }
}

/** Carga los retos y expone reclamar, girar la ruleta y el premio del cofre. */
function useQuestBoard() {
  const { user } = useAuth()
  const [view, setView] = useState<QuestsView | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  /** Premio del cofre recién abierto, para celebrarlo. */
  const [reward, setReward] = useState<ChestReward | null>(null)

  const tz = () => encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    fetch(`/api/students/${user.id}/quests?tz=${tz()}`)
      .then(readJson<QuestsView>)
      .then(data => {
        if (!cancelled && data) setView(data)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [user?.id])

  const act = async (url: string, key: string) => {
    if (!user?.id || busy) return
    setBusy(key)
    setError('')
    try {
      const res = await fetch(url, { method: 'POST' })
      const data = await readJson<QuestsView & { reward?: ChestReward | null; error?: string }>(res)
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo completar la acción.')
      if (data) {
        setView(data)
        if (data.reward) setReward(data.reward)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la acción.')
    } finally {
      setBusy(null)
    }
  }

  const claim = (questId: string) => act(`/api/students/${user?.id}/quests/${questId}/claim?tz=${tz()}`, questId)
  const spin = () => act(`/api/students/${user?.id}/quests/surprise?tz=${tz()}`, 'ruleta')

  return { view, busy, error, reward, setReward, claim, spin }
}

/** Una fila de reto: progreso, monedas y botón de reclamar. */
function QuestRow({
  quest,
  busy,
  onClaim,
}: {
  quest: QuestState
  busy: string | null
  onClaim: (id: string) => void
}) {
  const pct = Math.round((quest.progress / quest.target) * 100)

  return (
    // Dos niveles: el título manda arriba (ancho completo) y abajo van la
    // barra, las monedas y el botón; así no se corta nada en el lateral.
    <li className="space-y-2 rounded-xl border border-white/10 bg-black/25 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-sm text-white">
          <span className="truncate">{quest.label}</span>
          {quest.claimed && <Check className="h-3.5 w-3.5 shrink-0 text-emerald" />}
        </p>
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-amber">
          <Coins className="h-3.5 w-3.5" /> {quest.coins}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className={cn('h-full rounded-full transition-all duration-500', quest.done ? 'bg-emerald' : 'bg-cyan')}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 font-mono text-[10px] text-slate-500">
          {quest.progress}/{quest.target}
        </span>

        {quest.claimed ? (
          <span className="shrink-0 rounded-lg border border-emerald/40 px-2.5 py-1.5 text-[10px] uppercase tracking-widest text-emerald">
            Reclamado
          </span>
        ) : quest.done ? (
          <button
            onClick={() => onClaim(quest.id)}
            disabled={busy === quest.id}
            className="shrink-0 rounded-lg bg-cyan px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-black transition-colors hover:bg-cyan-400 disabled:opacity-50"
          >
            {busy === quest.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Reclamar'}
          </button>
        ) : (
          <span className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] uppercase tracking-widest text-slate-600">
            En curso
          </span>
        )}
      </div>
    </li>
  )
}

/** Tarjeta de los retos del día, la ruleta y el cofre. Va en Misiones. */
export function DailyQuests() {
  const { view, busy, error, reward, setReward, claim, spin } = useQuestBoard()

  if (!view) return null

  const reclamados = view.day.quests.filter(quest => quest.claimed).length
  const surprise = view.day.surprise

  return (
    <section className="rounded-2xl border border-white/10 bg-black/30 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-300">
          <Target className="h-4 w-4 text-cyan" /> Retos de hoy
        </h2>
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          {reclamados} de {view.day.quests.length} reclamados
        </span>
      </div>

      <ul className="space-y-2">
        {view.day.quests.map(quest => (
          <QuestRow key={quest.id} quest={quest} busy={busy} onClaim={claim} />
        ))}
      </ul>

      {/* Sorpresa del día: misión al azar con bonus de XP */}
      <div className="space-y-2 rounded-xl border border-violet/40 bg-violet/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <Dices className={cn('h-5 w-5 shrink-0', surprise?.consumed ? 'text-slate-500' : 'text-violet')} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white">Sorpresa del día</p>
            <p className="text-[11px] text-slate-500">
              {surprise
                ? surprise.consumed
                  ? 'Bonus conseguido. Vuelve mañana por otra misión.'
                  : `«${surprise.mission.title}» con +${surprise.xp_percent - 100}% de XP si la completas hoy.`
                : 'Gira la ruleta: una misión al azar con XP extra.'}
            </p>
          </div>
          {!surprise && (
            <button
              onClick={spin}
              disabled={busy === 'ruleta'}
              className="shrink-0 rounded-lg bg-violet px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-violet/80 disabled:opacity-50"
            >
              {busy === 'ruleta' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Girar'}
            </button>
          )}
          {surprise && !surprise.consumed && (
            <Link
              to={`/mission/${surprise.mission.id}`}
              className="shrink-0 rounded-lg bg-violet px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-violet/80"
            >
              Jugar
            </Link>
          )}
        </div>
      </div>

      {/* Cofre: se abre con todos los retos del día reclamados */}
      <div
        className={cn(
          'space-y-3 rounded-xl border px-4 py-3',
          view.day.chest.claimed
            ? 'border-emerald/30 bg-emerald/5'
            : view.day.chest.ready
              ? 'border-amber/50 bg-amber/10'
              : 'border-white/10 bg-black/20 opacity-60',
        )}
      >
        <div className="flex items-center gap-3">
          <Gift className={cn('h-5 w-5 shrink-0', view.day.chest.ready && !view.day.chest.claimed ? 'text-amber' : 'text-slate-500')} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white">Cofre del día</p>
            <p className="text-[11px] text-slate-500">
              {view.day.chest.claimed
                ? 'Abierto. Vuelve mañana por otro.'
                : view.day.chest.ready
                  ? '¡Listo! Ábrelo y descubre tu premio: monedas… o un escudo de racha.'
                  : 'Se abre al reclamar todos los retos de hoy.'}
            </p>
          </div>
        </div>

        {view.day.chest.claimed ? (
          <span className="block rounded-lg border border-emerald/40 py-2 text-center text-[10px] uppercase tracking-widest text-emerald">
            Abierto
          </span>
        ) : (
          <button
            onClick={() => claim('cofre-diario')}
            disabled={!view.day.chest.ready || busy === 'cofre-diario'}
            className={cn(
              'w-full rounded-lg py-2 text-[10px] font-bold uppercase tracking-widest transition-colors',
              view.day.chest.ready
                ? 'bg-amber text-black hover:bg-amber-light'
                : 'border border-white/10 text-slate-600 cursor-not-allowed',
            )}
          >
            Abrir
          </button>
        )}
      </div>

      {error && <p className="text-coral text-xs">{error}</p>}

      {/* Celebración del premio */}
      {reward && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-amber/40 bg-slate-950/95 p-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-amber/40 bg-amber/10">
              {reward.kind === 'shield' ? (
                <Shield className="h-7 w-7 text-amber" />
              ) : (
                <Coins className="h-7 w-7 text-amber" />
              )}
            </span>
            <h3 className="text-xl font-bold text-white">¡Premio del cofre!</h3>
            <p className="text-sm text-slate-300">{reward.label}</p>
            {reward.kind === 'shield' && (
              <p className="text-[11px] text-slate-500">Salvará un día perdido sin romper tu racha.</p>
            )}
            <button
              onClick={() => setReward(null)}
              className="w-full rounded-xl bg-amber py-3 text-[11px] font-bold uppercase tracking-widest text-black transition-colors hover:bg-amber-light"
            >
              ¡Genial!
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/** Tarjeta de los retos semanales. Va en el Pase. */
export function WeeklyQuests() {
  const { view, busy, error, claim } = useQuestBoard()

  if (!view || view.week.quests.length === 0) return null

  return (
    <section className="rounded-2xl border border-white/10 bg-black/30 p-5 space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-300">
        <Flame className="h-4 w-4 text-coral" /> Retos de la semana
      </h2>

      <ul className="space-y-2">
        {view.week.quests.map(quest => (
          <QuestRow key={quest.id} quest={quest} busy={busy} onClaim={claim} />
        ))}
      </ul>

      {error && <p className="text-coral text-xs">{error}</p>}
    </section>
  )
}
