/**
 * Ranking global: todos los alumnos registrados, por XP, misiones o tiempo.
 *
 * Las estadísticas son las de toda la app (lo hecho en cualquier misión). La
 * lista muestra el top y, si el alumno queda fuera, su propia posición aparte.
 */
import { useEffect, useMemo, useState } from 'react'
import { Crown, Loader2, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Canvas3DBackground } from '@/components/Canvas3DBackground'
import { readJson } from '@/lib/api'
import { useAuth } from '@/lib/hooks/useAuth'

type RankingMetric = 'xp' | 'missions' | 'time'

interface RankingEntry {
  position: number
  student_id: string
  name: string
  xp: number
  missions: number
  seconds: number
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

/** Una fila del ranking; la propia se resalta. */
function RankingRow({
  entry,
  metric,
  isMe,
}: {
  entry: RankingEntry
  metric: MetricConfig
  isMe: boolean
}) {
  return (
    <li
      className={cn(
        'flex items-center gap-4 rounded-2xl border px-5 py-4 transition-colors',
        isMe ? 'border-cyan/40 bg-cyan/10' : 'border-white/10 bg-black/20 hover:border-white/20',
      )}
    >
      <span
        className={cn(
          'w-8 shrink-0 text-center font-body text-xl font-black',
          POSITION_STYLE[entry.position] ?? 'text-slate-600',
        )}
      >
        {entry.position}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm text-white truncate">
          {entry.position === 1 && <Crown className="h-3.5 w-3.5 text-amber shrink-0" />}
          {entry.name}
          {isMe && (
            <span className="text-[9px] uppercase tracking-widest text-cyan border border-cyan/40 rounded px-1.5 py-0.5">
              tú
            </span>
          )}
        </p>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">
          {XP_FMT.format(entry.xp)} XP · {entry.missions} {entry.missions === 1 ? 'misión' : 'misiones'} ·{' '}
          {formatTime(entry.seconds)}
        </p>
      </div>

      <span className={cn('shrink-0 font-body text-lg font-bold', isMe ? 'text-cyan' : 'text-slate-200')}>
        {metric.value(entry)}
      </span>
    </li>
  )
}

export default function RankingPage() {
  const { user } = useAuth()
  const [metric, setMetric] = useState<RankingMetric>('xp')
  const [entries, setEntries] = useState<RankingEntry[]>([])
  const [you, setYou] = useState<RankingEntry | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
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
  }, [metric])

  const activeMetric = useMemo(() => METRICS.find(item => item.id === metric) ?? METRICS[0], [metric])
  const youInTop = you ? entries.some(entry => entry.student_id === you.student_id) : false

  return (
    <div className="relative min-h-[100vh] w-full bg-black/90">
      <Canvas3DBackground className="opacity-60" />

      <div className="relative z-10 min-h-screen p-8 font-mono max-w-4xl mx-auto space-y-8 animate-fade-in pt-16 lg:pt-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-body text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]">
              RANKING
            </h1>
            <p className="text-[11px] text-slate-500 uppercase tracking-widest mt-2">
              Todos los alumnos · {activeMetric.hint}
            </p>
          </div>
          {total > 0 && (
            <span className="text-[11px] text-slate-500 uppercase tracking-widest">
              {total} {total === 1 ? 'alumno' : 'alumnos'}
            </span>
          )}
        </header>

        {/* Métrica */}
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

        {loading && (
          <div className="flex items-center justify-center py-20 text-slate-500 gap-2 text-xs uppercase tracking-widest">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        )}

        {!loading && error && <p className="text-coral text-sm">{error}</p>}

        {!loading && !error && entries.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-2xl space-y-3">
            <Trophy className="h-8 w-8 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-xs uppercase tracking-widest">Todavía no hay actividad</p>
            <p className="text-[11px] text-slate-600">Completa una misión para estrenar el ranking.</p>
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
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

        {/* Fuera del top: su posición, con el mismo formato de fila */}
        {!loading && !error && you && !youInTop && (
          <div className="space-y-3 pt-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Tu posición</p>
            <ol className="space-y-2">
              <RankingRow entry={you} metric={activeMetric} isMe />
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
