/**
 * Rutas por objetivo: itinerarios curados sobre las misiones del nivel del
 * alumno. Cada ruta muestra su progreso y sus misiones en orden; las
 * completadas se marcan y las pendientes enlazan a jugar.
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
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {view.paths.map(path => {
              const Icon = ICONS[path.icon] ?? Compass
              const pct = Math.round((path.completed / path.total) * 100)
              return (
                <article
                  key={path.id}
                  className="space-y-4 rounded-2xl border border-white/10 bg-black/25 p-5"
                >
                  <div className="flex items-start gap-3">
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
                  </div>

                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', pct === 100 ? 'bg-emerald' : 'bg-cyan')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <ol className="space-y-1.5">
                    {path.missions.map((mission, index) => (
                      <li key={mission.mission_id}>
                        <Link
                          to={`/mission/${mission.mission_id}`}
                          className={cn(
                            'flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors',
                            mission.status === 'completed'
                              ? 'border-emerald/25 bg-emerald/5'
                              : 'border-white/10 bg-black/20 hover:border-cyan/40 hover:bg-cyan/5',
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px]',
                              mission.status === 'completed'
                                ? 'border-emerald/50 text-emerald'
                                : 'border-white/15 text-slate-500',
                            )}
                          >
                            {mission.status === 'completed' ? <Check className="h-3.5 w-3.5" /> : index + 1}
                          </span>
                          <span
                            className={cn(
                              'min-w-0 flex-1 truncate text-sm',
                              mission.status === 'completed' ? 'text-emerald-200' : 'text-white',
                            )}
                          >
                            {mission.title}
                          </span>
                          {mission.tier && (
                            <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-slate-600">
                              Nivel {mission.tier}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ol>
                </article>
              )
            })}
          </section>
        )}
      </div>
    </div>
  )
}
