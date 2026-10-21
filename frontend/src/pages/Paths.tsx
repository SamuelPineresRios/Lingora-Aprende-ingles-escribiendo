/**
 * Rutas por objetivo: itinerarios curados sobre las misiones del nivel del
 * alumno, pintados como un camino con nodos conectados.
 *
 * Cada ruta es un trazo serpenteante: las misiones completadas quedan en
 * verde, la siguiente brilla en cian y las pendientes esperan apagadas. El
 * trazo se dibuja en SVG detrás de los nodos (coordenadas porcentuales) y el
 * estado sale de lo completado, la misma fuente que el álbum y las medallas.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Check, Coffee, Compass, Loader2, Megaphone, Plane, Users, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { readJson } from '@/lib/api'
import { useAuth } from '@/lib/hooks/useAuth'
import { ModuleBackdrop } from '@/components/ModuleBackdrop'

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

/** Coordenadas (porcentaje) de los centros de los nodos: zigzag a 1/6 y 5/6. */
const NODE_X = [100 / 6, (100 / 6) * 5] as const
/** Cada fila mide lo mismo: 100 unidades de alto en el SVG. */
const ROW_UNITS = 100

/** El camino de una ruta: nodos alternos unidos por un trazo que sigue el progreso. */
function MissionTrail({ missions, level }: { missions: PathMission[]; level: string }) {
  const points = missions.map((_, index) => ({
    x: NODE_X[index % 2]!,
    y: (index + 0.5) * ROW_UNITS,
  }))
  const nextIndex = missions.findIndex(mission => mission.status === 'pending')

  return (
    <div className="relative">
      {/* El trazo del camino: sólido y verde lo completado, punteado lo pendiente */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 100 ${missions.length * ROW_UNITS}`}
        preserveAspectRatio="none"
      >
        {points.slice(1).map((point, index) => {
          const from = points[index]!
          const done =
            missions[index]!.status === 'completed' && missions[index + 1]!.status === 'completed'
          return (
            <line
              key={index}
              x1={from.x}
              y1={from.y}
              x2={point.x}
              y2={point.y}
              stroke={done ? 'rgba(52, 211, 153, 0.65)' : 'rgba(255, 255, 255, 0.14)'}
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray={done ? undefined : '3 8'}
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
      </svg>

      <ol className="relative">
        {missions.map((mission, index) => {
          const even = index % 2 === 0
          const completed = mission.status === 'completed'
          const isNext = index === nextIndex
          return (
            <li key={mission.mission_id}>
              <Link
                to={`/mission/${mission.mission_id}`}
                title={mission.title}
                className="grid h-20 grid-cols-3 items-center"
              >
                <span
                  className={cn(
                    'relative z-10 flex h-11 w-11 items-center justify-center justify-self-center rounded-full border-2 font-mono text-sm transition-colors',
                    even ? 'col-start-1' : 'col-start-3',
                    completed
                      ? 'border-emerald/60 bg-emerald/15 text-emerald'
                      : isNext
                        ? 'border-cyan bg-cyan/15 text-cyan shadow-[0_0_22px_rgba(6,182,212,0.35)]'
                        : 'border-white/15 bg-slate-950 text-slate-500',
                  )}
                >
                  {isNext && <span className="absolute inset-0 animate-ping rounded-full border border-cyan/40" />}
                  {completed ? <Check className="h-5 w-5" /> : index + 1}
                </span>

                <span
                  className={cn(
                    'min-w-0 rounded-xl border px-3 py-2 transition-colors',
                    even ? 'col-span-2 col-start-2' : 'col-span-2 col-start-1 text-right',
                    completed
                      ? 'border-emerald/20 bg-emerald/5'
                      : isNext
                        ? 'border-cyan/40 bg-cyan/10'
                        : 'border-white/10 bg-black/25 hover:border-cyan/30 hover:bg-cyan/5',
                  )}
                >
                  <span
                    className={cn(
                      'block truncate text-sm',
                      completed ? 'text-emerald-200' : isNext ? 'text-cyan-100' : 'text-white',
                    )}
                  >
                    {mission.title}
                  </span>
                  <span
                    className={cn(
                      'block text-[10px] uppercase tracking-widest',
                      completed ? 'text-emerald/70' : isNext ? 'text-cyan/70' : 'text-slate-600',
                    )}
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
              const pct = Math.round((path.completed / path.total) * 100)
              return (
                <article key={path.id} className="space-y-4 rounded-2xl border border-white/10 bg-black/25 p-5">
                  <header className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan/30 bg-cyan/5">
                      <Icon className="h-5 w-5 text-cyan" />
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

                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', pct === 100 ? 'bg-emerald' : 'bg-cyan')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <MissionTrail missions={path.missions} level={view.level} />
                </article>
              )
            })}
          </section>
        )}
      </div>
    </div>
  )
}
