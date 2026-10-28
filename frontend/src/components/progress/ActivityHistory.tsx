/**
 * Historial de actividad del alumno.
 *
 * Muestra las misiones completadas por día con dos vistas: la semana (siete
 * tarjetas) y el mes (calendario). Se navega con las flechas o se vuelve a
 * "Hoy", y al backend se le pide exactamente el rango que se está viendo: ni
 * un día más.
 */
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { readJson } from '@/lib/api'

interface DayActivity {
  date: string
  missions: number
  attempts: number
  seconds: number
}

interface ActivityResponse {
  activity?: DayActivity[]
}

const WEEKDAYS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']
const MONTH_FMT = new Intl.DateTimeFormat('es', { month: 'long' })
const MONTH_YEAR_FMT = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' })

/** Clave local `YYYY-MM-DD`; `toISOString()` usaría UTC y correría el día. */
function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/** Lunes de la semana de `date`. */
function startOfWeek(date: Date): Date {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return addDays(base, -((base.getDay() + 6) % 7))
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Segundos en algo legible: segundos, minutos u horas y minutos. */
function readableTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const totalMinutes = Math.round(seconds / 60)
  if (totalMinutes < 60) return `${totalMinutes} min`
  return `${Math.floor(totalMinutes / 60)} h ${totalMinutes % 60} min`
}

/** Fondo del día en el calendario según cuántas misiones se completaron. */
function intensityClass(missions: number): string {
  if (missions === 0) return 'bg-white/[0.02]'
  if (missions === 1) return 'bg-emerald-500/10'
  if (missions === 2) return 'bg-emerald-500/20'
  return 'bg-emerald-500/30'
}

/** Tooltip de un día: misiones, intentos y tiempo de escritura. */
function dayTitle(data: DayActivity | undefined): string {
  if (!data) return 'Sin actividad'
  const missions = `${data.missions} ${data.missions === 1 ? 'misión' : 'misiones'}`
  const attempts = `${data.attempts} ${data.attempts === 1 ? 'intento' : 'intentos'}`
  return `${missions} · ${attempts} · ${readableTime(data.seconds)}`
}

export function ActivityHistory({ studentId }: { studentId: string }) {
  const [view, setView] = useState<'week' | 'month'>('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const [days, setDays] = useState<Record<string, DayActivity>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** Sube con cada acción del usuario para forzar la recarga del rango. */
  const [requestId, setRequestId] = useState(0)

  const todayKey = dayKey(new Date())

  const range = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(anchor)
      return { from: dayKey(start), to: dayKey(addDays(start, 6)), start }
    }
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
    return { from: dayKey(start), to: dayKey(end), start }
  }, [view, anchor])

  useEffect(() => {
    let cancelled = false
    // El día se agrupa en la zona del alumno, no en la del servidor.
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    fetch(
      `/api/students/${studentId}/activity?from=${range.from}&to=${range.to}&tz=${encodeURIComponent(timezone)}`,
    )
      .then(readJson)
      .then((data: ActivityResponse) => {
        if (cancelled) return
        const map: Record<string, DayActivity> = {}
        for (const day of data?.activity ?? []) map[day.date] = day
        setDays(map)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar el historial.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [studentId, range.from, range.to, requestId])

  /** Muestra el spinner y relanza la petición (aunque el rango no cambie). */
  const reload = () => {
    setLoading(true)
    setError(null)
    setRequestId(id => id + 1)
  }

  const changeView = (option: 'week' | 'month') => {
    if (option === view) return
    setView(option)
    reload()
  }

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(range.start, index)),
    [range.start],
  )

  /** Celdas del mes: huecos iniciales para alinear el día 1 con su semana. */
  const monthCells = useMemo(() => {
    if (view !== 'month') return []
    const leading = (range.start.getDay() + 6) % 7
    const totalDays = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate()
    const cells: Array<Date | null> = Array.from({ length: leading }, () => null)
    for (let day = 1; day <= totalDays; day++) {
      cells.push(new Date(anchor.getFullYear(), anchor.getMonth(), day))
    }
    return cells
  }, [view, range.start, anchor])

  const totals = useMemo(() => {
    const entries = Object.values(days)
    return {
      missions: entries.reduce((sum, day) => sum + day.missions, 0),
      activeDays: entries.filter(day => day.attempts > 0).length,
      seconds: entries.reduce((sum, day) => sum + day.seconds, 0),
    }
  }, [days])

  const label = useMemo(() => {
    if (view === 'month') return capitalize(MONTH_YEAR_FMT.format(anchor))
    const end = addDays(range.start, 6)
    return range.start.getMonth() === end.getMonth()
      ? `${range.start.getDate()} – ${end.getDate()} de ${MONTH_FMT.format(end)}`
      : `${range.start.getDate()} ${MONTH_FMT.format(range.start)} – ${end.getDate()} ${MONTH_FMT.format(end)}`
  }, [view, anchor, range.start])

  const move = (delta: number) => {
    setAnchor(previous =>
      view === 'week'
        ? addDays(previous, delta * 7)
        : new Date(previous.getFullYear(), previous.getMonth() + delta, 1),
    )
    reload()
  }

  const goToToday = () => {
    setAnchor(new Date())
    reload()
  }

  return (
    <section className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-cyan" />
          Historial de actividad
        </h3>

        <div className="flex items-center gap-1 rounded-lg border border-white/10 p-0.5">
          {(['week', 'month'] as const).map(option => (
            <button
              key={option}
              onClick={() => changeView(option)}
              className={cn(
                'px-3 py-1 rounded-md text-[10px] font-mono uppercase tracking-widest transition-colors',
                view === option ? 'bg-cyan/15 text-cyan' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              {option === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          onClick={() => move(-1)}
          aria-label={view === 'week' ? 'Semana anterior' : 'Mes anterior'}
          className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-cyan hover:border-cyan/40 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-wider text-slate-300">{label}</span>
          <button
            onClick={goToToday}
            className="text-[10px] uppercase tracking-widest text-slate-500 hover:text-cyan transition-colors"
          >
            Hoy
          </button>
        </div>

        <button
          onClick={() => move(1)}
          aria-label={view === 'week' ? 'Semana siguiente' : 'Mes siguiente'}
          className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-cyan hover:border-cyan/40 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {error ? (
        <p className="text-[11px] text-coral text-center py-8">{error}</p>
      ) : (
        <div className={cn('transition-opacity', loading && 'opacity-40')}>
          {view === 'week' ? (
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {weekDays.map((day, index) => {
                const key = dayKey(day)
                const data = days[key]
                const isToday = key === todayKey
                const isFuture = key > todayKey
                return (
                  <div
                    key={key}
                    title={dayTitle(data)}
                    className={cn(
                      'rounded-xl border px-1 py-2 text-center transition-colors',
                      isToday ? 'border-cyan/50 bg-cyan/5' : 'border-white/10 bg-white/5',
                      isFuture && 'opacity-40',
                    )}
                  >
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">{WEEKDAYS[index]}</p>
                    <p className="text-sm font-bold text-white">{day.getDate()}</p>
                    <p className={cn('text-xl font-bold leading-tight', data?.missions ? 'text-emerald-400' : 'text-slate-600')}>
                      {data?.missions ?? 0}
                    </p>
                    <p className="text-[9px] uppercase text-slate-500">
                      {data?.missions === 1 ? 'misión' : 'misiones'}
                    </p>
                  </div>
                )
              })}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5">
                {WEEKDAYS.map(weekday => (
                  <div key={weekday} className="text-[9px] text-center uppercase tracking-wider text-slate-500">
                    {weekday}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {monthCells.map((day, index) => {
                  if (!day) return <div key={`hueco-${index}`} />
                  const key = dayKey(day)
                  const data = days[key]
                  const missions = data?.missions ?? 0
                  const isToday = key === todayKey
                  const isFuture = key > todayKey
                  return (
                    <div
                      key={key}
                      title={dayTitle(data)}
                      className={cn(
                        'aspect-square rounded-lg border flex flex-col items-center justify-center transition-colors',
                        intensityClass(missions),
                        isToday ? 'border-cyan/60 ring-1 ring-cyan/40' : 'border-white/10',
                        isFuture && 'opacity-40',
                      )}
                    >
                      <span className="text-[10px] text-slate-300 leading-none">{day.getDate()}</span>
                      {missions > 0 && (
                        <span className="text-[11px] font-bold text-emerald-300 leading-tight">{missions}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-white/5 text-[10px] uppercase tracking-wider text-slate-500">
        <span className="text-emerald-400">
          {totals.missions === 1 ? '1 misión completada' : `${totals.missions} misiones completadas`}
        </span>
        <span>{totals.activeDays === 1 ? '1 día con actividad' : `${totals.activeDays} días con actividad`}</span>
        <span>{readableTime(totals.seconds)} escribiendo</span>
      </footer>
    </section>
  )
}
