/**
 * Ranking: liga semanal (por defecto) y ranking global.
 *
 * La liga agrupa a los alumnos en brackets de 15 por XP de la semana en curso,
 * con ascensos y descensos; el global ordena a todos los registrados por XP,
 * misiones o tiempo de toda la app.
 */
import { ModuleBackdrop } from '@/components/ModuleBackdrop'
import { useEffect, useMemo, useState } from 'react'
import { Crown, Flame, Loader2, TrendingDown, TrendingUp, Trophy } from 'lucide-react'
import { resolveAvatar, type UserAvatar } from '@vox/shared'
import { cn } from '@/lib/utils'
import { FrameRing } from '@/components/FrameRing'
import { MedalBadge } from '@/components/MedalBadge'
import { studentAvatarUrl } from '@/lib/avatar'
import { readJson } from '@/lib/api'
import { useAuth } from '@/lib/hooks/useAuth'

type Mode = 'league' | 'global'
type RankingMetric = 'xp' | 'missions' | 'time'
type LeagueZone = 'promotion' | 'safe' | 'relegation'

/** Lo que un alumno lleva puesto y se pinta junto a su nombre. */
interface Cosmetics {
  avatar: UserAvatar | null
  frame: { id: string; colors: [string, string] } | null
  /** Títulos equipados, en su orden. */
  titles: Array<{ id: string; text: string }>
  /** Medallas ganadas, en orden de consecución. */
  medals: Array<{ id: string; name: string; icon: string }>
}

interface RankingEntry extends Cosmetics {
  position: number
  student_id: string
  name: string
  xp: number
  missions: number
  seconds: number
}

interface LeagueEntry extends Cosmetics {
  position: number
  student_id: string
  name: string
  week_xp: number
  zone: LeagueZone
}

interface WeeklyLeague {
  starts_at: string
  ends_at: string
  bracket: { index: number; total: number }
  size: number
  zones: { promote: number; relegate: number }
  entries: LeagueEntry[]
  my_zone: LeagueZone | null
}

const XP_FMT = new Intl.NumberFormat('es')
const NUMBER_FMT = new Intl.NumberFormat('es')

/** Tiempo de práctica legible: segundos, minutos u horas y minutos. */
function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  const totalMinutes = Math.round(seconds / 60)
  if (totalMinutes < 60) return `${totalMinutes} min`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`
}

/** Fechas legibles de la semana: "6 oct – 12 oct". */
function formatRange(startsAt: string, endsAt: string): string {
  const format = (key: string) =>
    new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(new Date(`${key}T12:00:00Z`))
  return `${format(startsAt)} – ${format(endsAt)}`
}

interface MetricConfig {
  id: RankingMetric
  label: string
  /** Frase que explica qué mide, para la cabecera. */
  hint: string
  value: (entry: RankingEntry) => string
}

const METRICS: MetricConfig[] = [
  { id: 'xp', label: 'XP', hint: 'XP acumulado en toda la app', value: entry => `${XP_FMT.format(entry.xp)} XP` },
  { id: 'missions', label: 'Misiones', hint: 'misiones completadas', value: entry => NUMBER_FMT.format(entry.missions) },
  { id: 'time', label: 'Tiempo', hint: 'tiempo de práctica', value: entry => formatTime(entry.seconds) },
]

/** Color de la posición: el podio se distingue del resto. */
const POSITION_STYLE: Record<number, string> = {
  1: 'text-amber',
  2: 'text-slate-300',
  3: 'text-coral',
}

/** Avatar del ranking con su marco (tienda o pase), como en el perfil. */
function RankingAvatar({ entry }: { entry: Cosmetics & { student_id: string } }) {
  const image = (
    <img
      src={studentAvatarUrl(resolveAvatar({ id: entry.student_id, avatar: entry.avatar }))}
      alt=""
      className="h-full w-full object-contain"
    />
  )

  if (entry.frame) {
    return (
      <FrameRing frameId={entry.frame.id} colors={entry.frame.colors} size={92}>
        <div className="flex h-full w-full items-center justify-center p-1">{image}</div>
      </FrameRing>
    )
  }

  return (
    <div className="h-[92px] w-[92px] shrink-0 rounded-full border border-white/10 bg-slate-950 p-1.5">
      <div className="h-full w-full overflow-hidden rounded-full">{image}</div>
    </div>
  )
}

/** Medallas ganadas en miniatura, junto al valor: 4 en escritorio (2 en
 * móvil, por espacio) y un contador con las que no caben. */
function MiniMedals({ medals }: { medals: Array<{ id: string; name: string; icon: string }> }) {
  if (medals.length === 0) return null
  const visibles = medals.slice(0, 4)

  return (
    <span className="flex shrink-0 items-center gap-1.5" title={medals.map(medal => medal.name).join(' · ')}>
      {visibles.map((medal, index) => (
        <span key={medal.id} className={cn(index >= 2 && 'hidden sm:inline-flex')}>
          <MedalBadge medal={{ icon: medal.icon, earned: true }} size={34} />
        </span>
      ))}
      {medals.length > 2 && (
        <span className="font-mono text-[11px] text-amber sm:hidden">+{medals.length - 2}</span>
      )}
      {medals.length > visibles.length && (
        <span className="hidden font-mono text-[11px] text-amber sm:inline">+{medals.length - visibles.length}</span>
      )}
    </span>
  )
}

/** Títulos equipados, con el mismo aspecto que en el perfil. */
function TitleBadge({ titles }: { titles: Array<{ id: string; text: string }> }) {
  if (titles.length === 0) return null
  return (
    <>
      {titles.map(title => (
        <span
          key={title.id}
          className="shrink-0 rounded-full border border-violet/40 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-violet"
        >
          {title.text}
        </span>
      ))}
    </>
  )
}

/** Una fila del ranking global; la propia se resalta. */
function RankingRow({ entry, metric, isMe }: { entry: RankingEntry; metric: MetricConfig; isMe: boolean }) {
  return (
    <li
      className={cn(
        'flex items-center gap-4 rounded-2xl border px-4 py-4 transition-colors sm:gap-5 sm:px-6 sm:py-5',
        isMe ? 'border-cyan/40 bg-cyan/10' : 'border-white/10 bg-black/20 hover:border-white/20',
      )}
    >
      <span
        className={cn(
          'w-9 shrink-0 text-center font-body text-2xl font-black',
          POSITION_STYLE[entry.position] ?? 'text-slate-600',
        )}
      >
        {entry.position}
      </span>

      <RankingAvatar entry={entry} />

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-base text-white">
          {entry.position === 1 && <Crown className="h-4 w-4 text-amber shrink-0" />}
          <span className="truncate">{entry.name}</span>
          {isMe && (
            <span className="shrink-0 text-[9px] uppercase tracking-widest text-cyan border border-cyan/40 rounded px-1.5 py-0.5">
              tú
            </span>
          )}
        </p>
        {entry.titles.length > 0 && (
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <TitleBadge titles={entry.titles} />
          </p>
        )}
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">
          {XP_FMT.format(entry.xp)} XP · {entry.missions} {entry.missions === 1 ? 'misión' : 'misiones'} ·{' '}
          {formatTime(entry.seconds)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <MiniMedals medals={entry.medals ?? []} />
        <span className={cn('font-body text-xl font-bold', isMe ? 'text-cyan' : 'text-slate-200')}>
          {metric.value(entry)}
        </span>
      </div>
    </li>
  )
}

/** Una fila de la liga: zona a la izquierda, XP de la semana a la derecha. */
function LeagueRow({ entry, isMe }: { entry: LeagueEntry; isMe: boolean }) {
  const zona =
    entry.zone === 'promotion'
      ? { icon: TrendingUp, className: 'text-emerald' }
      : entry.zone === 'relegation'
        ? { icon: TrendingDown, className: 'text-coral' }
        : { icon: null, className: 'text-slate-600' }
  const ZoneIcon = zona.icon

  return (
    <li
      className={cn(
        'flex items-center gap-4 rounded-2xl border px-4 py-4 transition-colors sm:gap-5 sm:px-6 sm:py-5',
        isMe ? 'border-cyan/40 bg-cyan/10' : 'border-white/10 bg-black/20 hover:border-white/20',
      )}
    >
      <span className="flex w-9 shrink-0 items-center justify-center gap-1 font-body text-2xl font-black text-slate-400">
        {entry.position}
        {ZoneIcon && <ZoneIcon className={cn('h-3.5 w-3.5', zona.className)} />}
      </span>

      <RankingAvatar entry={entry} />

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-base text-white">
          <span className="truncate">{entry.name}</span>
          {isMe && (
            <span className="shrink-0 text-[9px] uppercase tracking-widest text-cyan border border-cyan/40 rounded px-1.5 py-0.5">
              tú
            </span>
          )}
        </p>
        {entry.titles.length > 0 && (
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <TitleBadge titles={entry.titles} />
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <MiniMedals medals={entry.medals ?? []} />
        <span className={cn('font-body text-xl font-bold', isMe ? 'text-cyan' : 'text-slate-200')}>
          {XP_FMT.format(entry.week_xp)} XP
        </span>
      </div>
    </li>
  )
}

export default function RankingPage() {
  const { user } = useAuth()
  const [mode, setMode] = useState<Mode>('league')
  const [metric, setMetric] = useState<RankingMetric>('xp')
  const [entries, setEntries] = useState<RankingEntry[]>([])
  const [you, setYou] = useState<RankingEntry | null>(null)
  const [total, setTotal] = useState(0)
  const [league, setLeague] = useState<WeeklyLeague | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Liga semanal: solo se pide cuando la pestaña está activa.
  useEffect(() => {
    if (mode !== 'league' || !user?.id) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        const res = await fetch(`/api/students/${user.id}/league?tz=${encodeURIComponent(tz)}`)
        if (!res.ok) throw new Error('No se pudo cargar la liga.')
        const data = await readJson<WeeklyLeague>(res)
        if (!cancelled) setLeague(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar la liga.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [mode, user?.id])

  useEffect(() => {
    if (mode !== 'global') return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/students/ranking?metric=${metric}`)
        if (!res.ok) throw new Error('No se pudo cargar el ranking.')
        const data = await readJson<{ entries: RankingEntry[]; you: RankingEntry | null; total: number }>(res)
        if (cancelled) return
        setEntries(data?.entries ?? [])
        setYou(data?.you ?? null)
        setTotal(data?.total ?? 0)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar el ranking.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [mode, metric])

  const activeMetric = useMemo(() => METRICS.find(item => item.id === metric) ?? METRICS[0], [metric])

  return (
    <div className="relative min-h-[100vh] w-full bg-black/90">
      <ModuleBackdrop />

      <div className="relative z-10 min-h-screen p-4 font-mono max-w-4xl mx-auto sm:p-8 space-y-8 animate-fade-in pt-16 lg:pt-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-body text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]">
              RANKING
            </h1>
            <p className="text-[11px] text-slate-500 uppercase tracking-widest mt-2">
              {mode === 'league'
                ? 'Liga semanal · tu grupo de 15 por XP de la semana'
                : `Todos los alumnos · ${activeMetric.hint}`}
            </p>
          </div>
          {mode === 'global' && total > 0 && (
            <span className="text-[11px] text-slate-500 uppercase tracking-widest">
              {total} {total === 1 ? 'alumno' : 'alumnos'}
            </span>
          )}
        </header>

        {/* Pestañas: liga o global */}
        <div className="flex flex-wrap items-center gap-2">
          {([
            { id: 'league', label: 'Liga semanal', icon: Flame },
            { id: 'global', label: 'Global', icon: Trophy },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[11px] uppercase tracking-widest transition-colors',
                tab.id === mode
                  ? 'border-cyan/50 bg-cyan/10 text-cyan'
                  : 'border-white/10 text-slate-400 hover:border-white/30 hover:text-white',
              )}
            >
              <tab.icon className="h-3.5 w-3.5" /> {tab.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-slate-500 gap-2 text-xs uppercase tracking-widest">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        )}

        {!loading && error && <p className="text-coral text-sm">{error}</p>}

        {/* Liga semanal */}
        {!loading && !error && mode === 'league' && league && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-5 py-4">
              <div>
                <p className="text-sm text-white">
                  Liga {league.bracket.index + 1} de {league.bracket.total}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-1">
                  Semana {formatRange(league.starts_at, league.ends_at)}
                </p>
              </div>
              <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest">
                <span className="flex items-center gap-1.5 text-emerald">
                  <TrendingUp className="h-3.5 w-3.5" /> {league.zones.promote} ascienden
                </span>
                {league.zones.relegate > 0 && (
                  <span className="flex items-center gap-1.5 text-coral">
                    <TrendingDown className="h-3.5 w-3.5" /> {league.zones.relegate} descienden
                  </span>
                )}
              </div>
            </div>

            <ol className="space-y-2">
              {league.entries.map(entry => (
                <LeagueRow key={entry.student_id} entry={entry} isMe={entry.student_id === user?.id} />
              ))}
            </ol>
          </>
        )}

        {/* Ranking global */}
        {!loading && !error && mode === 'global' && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {METRICS.map(item => (
                <button
                  key={item.id}
                  onClick={() => setMetric(item.id)}
                  className={cn(
                    'px-4 py-2 rounded-lg border text-[11px] uppercase tracking-widest transition-colors',
                    item.id === metric
                      ? 'border-cyan/50 bg-cyan/10 text-cyan'
                      : 'border-white/10 text-slate-400 hover:border-white/30 hover:text-white',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {entries.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-2xl space-y-3">
                <Trophy className="h-8 w-8 text-slate-600 mx-auto" />
                <p className="text-slate-400 text-xs uppercase tracking-widest">Todavía no hay actividad</p>
                <p className="text-[11px] text-slate-600">Completa una misión para estrenar el ranking.</p>
              </div>
            ) : (
              <ol className="space-y-2">
                {entries.map(entry => (
                  <RankingRow
                    key={entry.student_id}
                    entry={entry}
                    metric={activeMetric}
                    isMe={entry.student_id === user?.id}
                  />
                ))}
              </ol>
            )}

            {you && !entries.some(entry => entry.student_id === you.student_id) && (
              <div className="space-y-3 pt-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">Tu posición</p>
                <ol className="space-y-2">
                  <RankingRow entry={you} metric={activeMetric} isMe />
                </ol>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
