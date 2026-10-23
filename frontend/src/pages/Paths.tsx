/**
 * Rutas por objetivo: cada itinerario es un camino de videojuego.
 *
 * La carretera se dibuja en SVG (trazos curvos con relieve) y los nodos son
 * estaciones: completadas con check, la siguiente brillando y el resto
 * apagadas. El avatar del alumno (con su marco) flota sobre el nodo actual,
 * como la ficha que avanza por el mapa. Cada ruta tiene su color.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Briefcase,
  Check,
  Coffee,
  Compass,
  Flag,
  Loader2,
  Megaphone,
  Plane,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { readJson } from '@/lib/api'
import { useAuth } from '@/lib/hooks/useAuth'
import { useStoreView, useThemeAccent } from '@/lib/hooks/useStoreView'
import { equippedItem } from '@/lib/store'
import { FrameRing } from '@/components/FrameRing'
import { ModuleBackdrop } from '@/components/ModuleBackdrop'
import { resolveAvatar } from '@vox/shared'
import { studentAvatarUrl } from '@/lib/avatar'

interface PathMission {
  mission_id: string
  title: string
  tier: number | null
  status: 'completed' | 'pending'
}

interface LearningPath {
  id: string
  label: string
  description: string
  icon: string
  total: number
  completed: number
  missions: PathMission[]
}

interface PathsView {
  level: string
  paths: LearningPath[]
}

const ICONS: Record<string, LucideIcon> = {
  plane: Plane,
  coffee: Coffee,
  users: Users,
  briefcase: Briefcase,
  megaphone: Megaphone,
}

/** Color de cada ruta: cada una es un «mundo» distinto. */
const ACCENTS: Record<string, string> = {
  plane: '#22d3ee',
  coffee: '#f59e0b',
  users: '#a78bfa',
  briefcase: '#34d399',
  megaphone: '#fb7185',
}

/** Coordenadas (porcentaje del ancho) de los nodos: zigzag a 1/6 y 5/6. */
const NODE_X = [100 / 6, (100 / 6) * 5] as const
/** Cada fila mide 100 unidades de alto en el SVG. */
const ROW_UNITS = 100

/** El camino: carretera curva, estaciones y el avatar sobre el nodo actual. */
function MissionTrail({
  missions,
  level,
  accent,
  avatar,
}: {
  missions: PathMission[]
  level: string
  accent: string
  avatar: ReactNode
}) {
  const count = missions.length
  const viewHeight = count * ROW_UNITS
  const points = missions.map((_, index) => ({
    x: NODE_X[index % 2]!,
    y: (index + 0.5) * ROW_UNITS,
  }))
  const nextIndex = missions.findIndex(mission => mission.status === 'pending')
  const hereIndex = nextIndex === -1 ? count - 1 : nextIndex
  const here = points[hereIndex]!
  const percentY = (value: number) => `${(value / viewHeight) * 100}%`

  return (
    <div className="relative">
      {/* Carretera: base oscura + firme coloreado según lo completado */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 100 ${viewHeight}`}
        preserveAspectRatio="none"
      >
        {points.slice(1).map((point, index) => {
          const from = points[index]!
          const mid = (from.y + point.y) / 2
          const road = `M ${from.x} ${from.y} C ${from.x} ${mid}, ${point.x} ${mid}, ${point.x} ${point.y}`
          const done =
            missions[index]!.status === 'completed' && missions[index + 1]!.status === 'completed'
          return (
            <g key={index}>
              <path
                d={road}
                fill="none"
                stroke="rgba(2, 6, 23, 0.92)"
                strokeWidth={26}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={road}
                fill="none"
                stroke={done ? `${accent}8c` : 'rgba(255, 255, 255, 0.08)'}
                strokeWidth={15}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={road}
                fill="none"
                stroke="rgba(255, 255, 255, 0.06)"
                strokeWidth={3}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )
        })}
      </svg>

      {/* Estaciones */}
      {points.map((point, index) => {
        const completed = missions[index]!.status === 'completed'
        const isNext = index === nextIndex
        return (
          <span
            key={index}
            aria-hidden
            className="pointer-events-none absolute z-10 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 font-mono text-sm"
            style={{
              left: `${point.x}%`,
              top: percentY(point.y),
              ...(completed
                ? { borderColor: `${accent}aa`, background: '#0b1220', color: accent }
                : isNext
                  ? { borderColor: accent, background: '#0b1220', color: accent, boxShadow: `0 0 24px ${accent}66` }
                  : { borderColor: 'rgba(255,255,255,0.14)', background: '#020617', color: '#64748b' }),
            }}
          >
            {isNext && (
              <span
                className="absolute inset-0 animate-ping rounded-full border"
                style={{ borderColor: `${accent}66` }}
              />
            )}
            {completed ? <Check className="h-5 w-5" /> : index + 1}
          </span>
        )
      })}

      {/* Tu avatar, de pie sobre el nodo actual */}
      <div
        aria-hidden
        className="pointer-events-none absolute z-20"
        style={{ left: `${here.x}%`, top: percentY(here.y), transform: 'translate(-50%, -78%)' }}
      >
        <div className="animate-[route-avatar-bob_2.6s_ease-in-out_infinite] motion-reduce:animate-none">
          {avatar}
        </div>
      </div>

      {/* Etiquetas: la estación queda en el lado contrario de cada fila */}
      <ol className="relative">
        {missions.map((mission, index) => {
          const even = index % 2 === 0
          const completed = mission.status === 'completed'
          const isNext = index === nextIndex
          return (
            <li key={mission.mission_id}>
              <Link to={`/mission/${mission.mission_id}`} title={mission.title} className="grid h-20 grid-cols-3 items-center">
                <span
                  className={cn(
                    'min-w-0 rounded-xl border px-3 py-2 backdrop-blur-[1px] transition-colors',
                    even ? 'col-span-2 col-start-2' : 'col-span-2 col-start-1 text-right',
                    completed
                      ? 'border-emerald/20 bg-emerald/5'
                      : isNext
                        ? undefined
                        : 'border-white/10 bg-black/30 hover:border-cyan/30 hover:bg-cyan/5',
                  )}
                  style={
                    isNext
                      ? { borderColor: `${accent}66`, background: `${accent}14` }
                      : undefined
                  }
                >
                  <span
                    className={cn(
                      'block truncate text-sm',
                      completed ? 'text-emerald-200' : isNext ? undefined : 'text-white',
                    )}
                    style={isNext ? { color: accent } : undefined}
                  >
                    {mission.title}
                  </span>
                  <span
                    className={cn(
                      'block text-[10px] uppercase tracking-widest',
                      completed ? 'text-emerald/70' : isNext ? undefined : 'text-slate-600',
                    )}
                    style={isNext ? { color: `${accent}b3` } : undefined}
                  >
                    {completed ? 'Completada' : isNext ? 'Siguiente' : `Nivel ${mission.tier ?? 1} · ${level}`}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default function PathsPage() {
  const { user } = useAuth()
  const store = useStoreView(user?.id)
  const themeAccent = useThemeAccent(user?.id)
  const [view, setView] = useState<PathsView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    fetch(`/api/students/${user.id}/paths`)
      .then(readJson<PathsView>)
      .then(data => {
        if (!cancelled && data) setView(data)
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudieron cargar las rutas.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id])

  const frame = equippedItem(store, 'frame')
  const avatarUrl = user ? studentAvatarUrl(resolveAvatar({ id: user.id, avatar: user.avatar })) : null
  const avatar: ReactNode = avatarUrl ? (
    frame && frame.colors ? (
      <FrameRing frameId={frame.id} colors={frame.colors} accent={themeAccent} size={62}>
        <img src={avatarUrl} alt="" className="h-full w-full" />
      </FrameRing>
    ) : (
      <img src={avatarUrl} alt="" className="h-[62px] w-[62px] drop-shadow-[0_8px_10px_rgba(0,0,0,0.55)]" />
    )
  ) : null

  const totalMissions = view?.paths.reduce((sum, path) => sum + path.total, 0) ?? 0
  const totalCompleted = view?.paths.reduce((sum, path) => sum + path.completed, 0) ?? 0

  return (
    <div className="relative min-h-[100vh] w-full bg-black/90">
      <ModuleBackdrop />

      <div className="relative z-10 min-h-screen p-4 font-mono max-w-6xl mx-auto sm:p-8 space-y-8 animate-fade-in pt-16 lg:pt-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-body text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]">
              RUTAS
            </h1>
            <p className="text-[11px] text-slate-500 uppercase tracking-widest mt-2">
              {view
                ? `Itinerarios por objetivo · tu nivel ${view.level} · ${totalCompleted} de ${totalMissions} misiones`
                : 'Itinerarios por objetivo'}
            </p>
          </div>
        </header>

        {loading && (
          <div className="flex items-center justify-center py-20 text-slate-500 gap-2 text-xs uppercase tracking-widest">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        )}

        {!loading && error && <p className="text-coral text-sm">{error}</p>}

        {!loading && view && view.paths.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-2xl space-y-2">
            <Compass className="h-8 w-8 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-xs uppercase tracking-widest">Aún no hay rutas para tu nivel</p>
          </div>
        )}

        {!loading && view && view.paths.length > 0 && (
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {view.paths.map(path => {
              const Icon = ICONS[path.icon] ?? Compass
              const accent = ACCENTS[path.icon] ?? '#22d3ee'
              const pct = Math.round((path.completed / path.total) * 100)
              const finished = path.completed >= path.total
              return (
                <article
                  key={path.id}
                  className="relative space-y-4 overflow-hidden rounded-3xl border border-white/10 bg-black/25 p-5"
                  style={{
                    backgroundImage: `radial-gradient(120% 80% at 15% 0%, ${accent}14, transparent 55%), radial-gradient(100% 70% at 85% 100%, ${accent}0d, transparent 50%)`,
                  }}
                >
                  {/* Decoración tenue del mundo de la ruta */}
                  <Icon
                    aria-hidden
                    className="pointer-events-none absolute -right-3 top-14 h-24 w-24 opacity-[0.05]"
                    style={{ color: accent }}
                  />

                  <header className="relative flex items-start gap-3">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
                      style={{ borderColor: `${accent}55`, background: `${accent}14`, color: accent }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="font-body text-lg font-semibold text-white">{path.label}</h2>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                          {path.completed} de {path.total}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">{path.description}</p>
                    </div>
                  </header>

                  <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: accent }}
                    />
                  </div>

                  {finished && (
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald">
                      <Flag className="h-3.5 w-3.5" /> Ruta completada
                    </p>
                  )}

                  <MissionTrail missions={path.missions} level={view.level} accent={accent} avatar={avatar} />
                </article>
              )
            })}
          </section>
        )}
      </div>
    </div>
  )
}
