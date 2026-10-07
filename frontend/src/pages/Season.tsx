/**
 * Pase de temporada, con la estructura de un pase de batalla: la recompensa
 * seleccionada en grande, la pista de 20 casillas debajo, el banco de monedas
 * y los filtros por tipo. Todo con la identidad de la app.
 *
 * La temporada rota sola cada 4 semanas; el progreso y el catálogo los calcula
 * el backend, aquí solo se pinta.
 */
import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Coins, Lock, Medal, Store } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Canvas3DBackground } from '@/components/Canvas3DBackground'
import { readJson } from '@/lib/api'
import { useAuth } from '@/lib/hooks/useAuth'
import { avatarUrl } from '@/lib/avatar'
import {
  badgeIcon,
  seasonRange,
  unlockedBadges,
  type SeasonProgress,
  type SeasonReward,
} from '@/lib/season'

type RewardKind = SeasonReward['kind']
type Filter = 'all' | RewardKind

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Todo' },
  { id: 'frame', label: 'Marcos' },
  { id: 'badge', label: 'Insignias' },
  { id: 'coins', label: 'Monedas' },
]

const KIND_LABEL: Record<RewardKind, string> = {
  coins: 'Monedas',
  badge: 'Insignia',
  frame: 'Marco',
}

/** Anillo del marco, reutilizado en la tarjeta grande y en las casillas. */
function FrameRing({ colors, size = 'h-10 w-10' }: { colors: [string, string]; size?: string }) {
  return (
    <span
      className={cn('block rounded-full p-[3px]', size)}
      style={{ backgroundImage: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
    >
      <span className="block h-full w-full rounded-full bg-slate-950" />
    </span>
  )
}

/** Icono de una recompensa, al tamaño pedido. */
function RewardIcon({ reward, size = 'h-10 w-10' }: { reward: SeasonReward; size?: string }) {
  if (reward.kind === 'coins') {
    return (
      <span className={cn('flex items-center justify-center rounded-full border border-amber/40 bg-amber/10', size)}>
        <Coins className="h-[55%] w-[55%] text-amber" />
      </span>
    )
  }
  if (reward.kind === 'badge') {
    return (
      <span className={cn('flex items-center justify-center rounded-full border border-violet/40 bg-violet/10', size)}>
        {createElement(badgeIcon(reward.id), { className: 'h-[55%] w-[55%] text-violet' })}
      </span>
    )
  }
  return <FrameRing colors={reward.colors} size={size} />
}

/** Tarjeta grande: la recompensa seleccionada, con su estado. */
function FeaturedReward({
  reward,
  unlocked,
  avatarSeed,
}: {
  reward: SeasonReward
  unlocked: boolean
  avatarSeed: string
}) {
  const estado = unlocked ? 'Desbloqueada' : `Se desbloquea en la casilla ${reward.tier}`

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40">
      {/* Luz de fondo del panel, como el render del operativo */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            reward.kind === 'frame'
              ? `radial-gradient(ellipse at 50% 40%, ${reward.colors[0]}55 0%, transparent 65%)`
              : reward.kind === 'badge'
                ? 'radial-gradient(ellipse at 50% 40%, rgba(139,92,246,0.35) 0%, transparent 65%)'
                : 'radial-gradient(ellipse at 50% 40%, rgba(245,158,11,0.3) 0%, transparent 65%)',
        }}
      />

      <div className="relative flex min-h-[320px] flex-col items-center justify-center gap-5 px-8 py-10 text-center">
        {reward.kind === 'frame' ? (
          <div className={cn('transition-all duration-500', !unlocked && 'opacity-45 grayscale')}>
            <div
              className="rounded-full p-1"
              style={{ backgroundImage: `linear-gradient(135deg, ${reward.colors[0]}, ${reward.colors[1]})` }}
            >
              <div className="rounded-full bg-slate-950 p-1">
                <img src={avatarUrl(avatarSeed)} alt="" className="h-44 w-44 sm:h-52 sm:w-52" />
              </div>
            </div>
          </div>
        ) : (
          <div className={cn('transition-all duration-500', !unlocked && 'opacity-45 grayscale')}>
            <RewardIcon reward={reward} size="h-32 w-32" />
          </div>
        )}

        <div className="space-y-1">
          <p className="font-display text-3xl font-semibold text-white">{reward.label}</p>
          <p className="text-[11px] font-mono uppercase tracking-[0.25em] text-slate-400">
            {KIND_LABEL[reward.kind]} · casilla {reward.tier}
          </p>
        </div>

        <span
          className={cn(
            'rounded-full border px-3 py-1 text-[10px] font-mono uppercase tracking-widest',
            unlocked ? 'border-cyan/50 bg-cyan/10 text-cyan' : 'border-white/15 text-slate-400',
          )}
        >
          {estado}
        </span>

        <p className="max-w-md text-xs text-slate-500">
          {reward.kind === 'frame' && 'Se aplica a tu avatar del perfil.'}
          {reward.kind === 'badge' && reward.description}
          {reward.kind === 'coins' && 'Monedas para la tienda (próximamente).'}
        </p>
      </div>
    </section>
  )
}

export default function SeasonPage() {
  const { user } = useAuth()
  const [progress, setProgress] = useState<SeasonProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedTier, setSelectedTier] = useState<number | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/students/${user.id}/season`)
        if (!res.ok) throw new Error('No se pudo cargar el pase.')
        const data = await readJson<SeasonProgress>(res)
        if (!cancelled) setProgress(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar el pase.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const badges = unlockedBadges(progress)

  /** Casilla mostrada: la elegida o, por defecto, la siguiente por desbloquear. */
  const featuredTier = useMemo(() => {
    if (!progress) return 1
    if (selectedTier) return selectedTier
    return Math.min(progress.tier + 1, progress.rewards.length)
  }, [progress, selectedTier])

  const featured = progress?.rewards.find(reward => reward.tier === featuredTier) ?? null

  // La casilla actual queda a la vista sin tener que desplazarse.
  useEffect(() => {
    if (!progress) return
    const selector = `[aria-label^="Casilla ${featuredTier}:"]`
    trackRef.current?.querySelector(selector)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [progress, featuredTier])

  const header = (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-cyan">Pase · Temporada {progress?.season.number ?? 1}</p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-white mt-1">
          {featured ? featured.label : 'Pase de temporada'}
        </h1>
        <p className="text-[11px] font-mono uppercase tracking-widest text-slate-500 mt-2">
          {progress ? `${seasonRange(progress)} · quedan ${progress.season.days_left} días` : 'Temporada en curso'}
        </p>
      </div>

      <div className="flex flex-col items-end gap-2">
        <div className="rounded-2xl border border-amber/30 bg-amber/5 px-5 py-3 text-right">
          <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-amber/80">Monedas</p>
          <p className="font-body text-3xl font-black text-amber">{progress?.coins ?? 0}</p>
        </div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          {badges.length} {badges.length === 1 ? 'insignia' : 'insignias'} desbloqueadas
        </p>
      </div>
    </header>
  )

  return (
    <div className="relative min-h-[100vh] w-full bg-black/90">
      <Canvas3DBackground className="opacity-60" />

      <div className="relative z-10 min-h-screen px-6 py-8 font-mono lg:px-10 animate-fade-in pt-16 lg:pt-8">
        <div className="mx-auto max-w-6xl space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-24 text-slate-500 gap-2 text-xs uppercase tracking-widest">
              <Medal className="h-4 w-4 animate-pulse" /> Cargando el pase…
            </div>
          )}

          {!loading && error && <p className="text-coral text-sm">{error}</p>}

          {!loading && !error && progress && featured && (
            <>
              {header}

              {/* Progreso de la temporada, fino y bajo la cabecera */}
              <div className="space-y-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-cyan shadow-[0_0_10px_rgba(6,182,212,0.6)] transition-all duration-700"
                    style={{ width: `${Math.round((progress.tier_xp / progress.tier_span) * 100)}%` }}
                  />
                </div>
                <div className="flex flex-wrap justify-between gap-2 text-[10px] uppercase tracking-widest text-slate-500">
                  <span>
                    Casilla {progress.tier} de {progress.rewards.length} · {progress.xp} XP de temporada
                  </span>
                  <span>
                    {progress.xp_to_next_tier === 0
                      ? 'Pase completado'
                      : `Faltan ${progress.xp_to_next_tier} XP para la casilla ${progress.tier + 1}`}
                  </span>
                </div>
              </div>

              <FeaturedReward
                reward={featured}
                unlocked={featured.unlocked}
                avatarSeed={user?.full_name ?? 'Letoura'}
              />

              {/* Filtros por tipo de recompensa */}
              <div className="flex flex-wrap items-center gap-2">
                {FILTERS.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setFilter(item.id)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-[10px] uppercase tracking-widest transition-colors',
                      item.id === filter
                        ? 'border-cyan/50 bg-cyan/10 text-cyan'
                        : 'border-white/10 text-slate-400 hover:border-white/30 hover:text-white',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
                {selectedTier && (
                  <button
                    onClick={() => setSelectedTier(null)}
                    className="ml-auto text-[10px] uppercase tracking-widest text-slate-500 hover:text-cyan"
                  >
                    Volver a la casilla actual
                  </button>
                )}
              </div>

              {/* Pista de casillas */}
              <div ref={trackRef} className="flex gap-3 overflow-x-auto pb-3 pt-1 scrollbar-none">
                {progress.rewards.map(reward => {
                  const selected = reward.tier === featuredTier
                  const dimmed = filter !== 'all' && reward.kind !== filter
                  return (
                    <button
                      key={reward.tier}
                      aria-label={`Casilla ${reward.tier}: ${reward.label}`}
                      onClick={() => setSelectedTier(reward.tier)}
                      className={cn(
                        'relative w-[104px] shrink-0 rounded-2xl border px-3 pb-3 pt-6 text-center transition-all duration-300',
                        selected && 'border-cyan/60 bg-cyan/10 shadow-[0_0_25px_-8px_rgba(6,182,212,0.9)]',
                        !selected && reward.unlocked && 'border-white/15 bg-black/30 hover:border-cyan/40',
                        !selected && !reward.unlocked && 'border-white/10 bg-black/20 opacity-50 grayscale',
                        dimmed && 'opacity-25',
                      )}
                    >
                      <span className="absolute left-3 top-2 text-[10px] text-slate-500">{reward.tier}</span>
                      {!reward.unlocked && <Lock className="absolute right-3 top-2 h-3 w-3 text-slate-600" />}
                      <div className="flex flex-col items-center gap-2">
                        <RewardIcon reward={reward} />
                        <p className="line-clamp-2 text-[10px] leading-tight text-slate-300">{reward.label}</p>
                      </div>
                      {selected && (
                        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-cyan px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-black">
                          Ahora
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Barra inferior, como las pestañas del pase */}
              <div className="flex flex-wrap items-center gap-4 border-t border-white/10 pt-4">
                <span className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white">
                  <Medal className="h-4 w-4 text-cyan" /> Pase de temporada
                </span>
                <Link
                  to="/store"
                  className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-amber hover:opacity-80 transition-opacity"
                >
                  <Store className="h-4 w-4" /> Gastar monedas en la tienda
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
