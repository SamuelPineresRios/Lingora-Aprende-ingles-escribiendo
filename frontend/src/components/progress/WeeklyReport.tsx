/**
 * Informe semanal del alumno: la semana en curso contra la anterior, con la
 * evolución de las últimas seis semanas. Vive en el perfil.
 *
 * Los datos salen de `/weekly-report` (semana del lunes en la zona del
 * alumno): misiones, XP, tiempo, precisión gramatical, palabras del
 * vocabulario y estructuras más practicadas.
 */
import { useEffect, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowDownRight, ArrowUpRight, BarChart3, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { readJson } from '@/lib/api'
import { useAuth } from '@/lib/hooks/useAuth'

interface WeekStats {
  missions: number
  xp: number
  seconds: number
  grammar: number | null
  vocabulary: number | null
  comprehension: number | null
}

interface WeeklyReport {
  week: { starts_at: string; ends_at: string }
  current: WeekStats
  previous: WeekStats
  deltas: { missions: number; xp: number; seconds: number; grammar: number | null }
  words: { saved_this_week: number; mastered_total: number }
  top_structures: Array<{ structure: string; count: number }>
  /** Errores gramaticales de la semana, con las reglas más repetidas. */
  errors: {
    this_week: number
    previous_week: number
    delta: number
    top: Array<{ type: string; label: string; count: number }>
  }
  evolution: Array<{ week_start_date: string; missions: number; xp: number; seconds: number; grammar: number | null }>
}

/** «6 oct – 12 oct» a partir de claves YYYY-MM-DD. */
function formatRange(startsAt: string, endsAt: string): string {
  const format = (key: string) =>
    new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(new Date(`${key}T12:00:00Z`))
  return `${format(startsAt)} – ${format(endsAt)}`
}

/** Etiqueta corta para el eje de la gráfica. */
function formatShort(key: string): string {
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(new Date(`${key}T12:00:00Z`))
}

/** Tiempo de práctica legible. */
function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

/** Diferencia contra la semana pasada, con flecha y color. */
function Delta({ value, unit = '', suffix = '' }: { value: number | null; unit?: string; suffix?: string }) {
  if (value === null) return <span className="text-slate-500">—</span>
  if (value === 0) {
    return (
      <span className="flex items-center gap-0.5 text-slate-500">
        <Minus className="h-3 w-3" /> igual
      </span>
    )
  }
  const up = value > 0
  return (
    <span className={cn('flex items-center gap-0.5', up ? 'text-emerald' : 'text-coral')}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {up ? '+' : ''}
      {value}
      {unit}
      {suffix}
    </span>
  )
}

export function WeeklyReport() {
  const { user } = useAuth()
  const [report, setReport] = useState<WeeklyReport | null>(null)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)

    fetch(`/api/students/${user.id}/weekly-report?tz=${tz}`)
      .then(readJson<WeeklyReport>)
      .then(data => {
        if (!cancelled && data) setReport(data)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [user?.id])

  if (!report) return null

  const sinDatos = report.current.missions === 0 && report.previous.missions === 0

  return (
    <section className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-cyan" />
          Informe semanal
        </h3>
        <span className="text-[10px] uppercase tracking-widest text-slate-500">
          {formatRange(report.week.starts_at, report.week.ends_at)}
        </span>
      </div>

      {sinDatos ? (
        <p className="text-[11px] text-slate-500">
          Completa misiones esta semana y aquí verás tu informe: misiones, precisión, palabras y tu evolución.
        </p>
      ) : (
        <>
          {/* Semana en curso contra la anterior */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Misiones</p>
              <p className="mt-1 font-body text-xl font-bold text-white">{report.current.missions}</p>
              <p className="mt-0.5 text-[11px]">
                <Delta value={report.deltas.missions} />
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">XP</p>
              <p className="mt-1 font-body text-xl font-bold text-white">{report.current.xp}</p>
              <p className="mt-0.5 text-[11px]">
                <Delta value={report.deltas.xp} />
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Tiempo</p>
              <p className="mt-1 font-body text-xl font-bold text-white">{formatTime(report.current.seconds)}</p>
              <p className="mt-0.5 text-[11px]">
                <Delta value={Math.round(report.deltas.seconds / 60)} unit=" min" />
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Precisión</p>
              <p className="mt-1 font-body text-xl font-bold text-white">
                {report.current.grammar !== null ? `${Math.round(report.current.grammar)}%` : '—'}
              </p>
              <p className="mt-0.5 text-[11px]">
                <Delta value={report.deltas.grammar} unit="%" />
              </p>
            </div>
          </div>

          {/* Evolución de las últimas seis semanas */}
          <div className="h-48 w-full sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={report.evolution} margin={{ top: 22, right: 2, bottom: 2, left: 0 }}>
                <defs>
                  <linearGradient id="weekly-mission-bars" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#0e7490" stopOpacity={0.32} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.07)" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="week_start_date"
                  tickFormatter={formatShort}
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                  minTickGap={12}
                  padding={{ left: 14, right: 14 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="m"
                  allowDecimals={false}
                  width={24}
                  tickCount={4}
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="g"
                  orientation="right"
                  domain={[0, 100]}
                  ticks={[0, 50, 100]}
                  width={34}
                  tickFormatter={value => `${value}%`}
                  tick={{ fill: 'rgba(251,191,36,0.65)', fontSize: 9, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{
                    background: 'rgba(2,6,23,0.96)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 12,
                    fontSize: 12,
                    boxShadow: '0 10px 30px -12px rgba(6,182,212,0.45)',
                  }}
                  labelStyle={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}
                  itemStyle={{ paddingTop: 2 }}
                  labelFormatter={formatShort}
                  formatter={(value: number, name: string) =>
                    name === 'Precisión'
                      ? [`${Math.round(value)}%`, name]
                      : [`${value} ${value === 1 ? 'misión' : 'misiones'}`, name]
                  }
                />
                <Bar
                  yAxisId="m"
                  dataKey="missions"
                  name="Misiones"
                  fill="url(#weekly-mission-bars)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={42}
                  background={{ fill: 'rgba(255,255,255,0.035)' }}
                >
                  <LabelList
                    dataKey="missions"
                    position="top"
                    offset={7}
                    fill="rgba(255,255,255,0.72)"
                    fontSize={10}
                    fontFamily="monospace"
                    formatter={(value: number) => (value > 0 ? String(value) : '')}
                  />
                </Bar>
                <Line
                  yAxisId="g"
                  dataKey="grammar"
                  name="Precisión"
                  type="monotone"
                  stroke="#fbbf24"
                  strokeWidth={2.5}
                  dot={{ r: 4, strokeWidth: 2, stroke: '#020617', fill: '#fbbf24' }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: '#020617', fill: '#fde68a' }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[10px] uppercase tracking-widest text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-cyan" /> Misiones
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full bg-amber" /> Precisión gramatical
            </span>
          </div>

          {/* Vocabulario y estructuras */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-4">
            <p className="text-[11px] text-slate-400">
              <span className="text-white">{report.words.saved_this_week}</span> palabras guardadas esta semana ·{' '}
              <span className="text-white">{report.words.mastered_total}</span> dominadas
            </p>
            {report.top_structures.length > 0 && (
              <p className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-500">
                Más practicadas:
                {report.top_structures.map(structure => (
                  <span
                    key={structure.structure}
                    className="rounded-full border border-cyan/30 bg-cyan/5 px-2 py-0.5 text-cyan"
                  >
                    {structure.structure} ×{structure.count}
                  </span>
                ))}
              </p>
            )}
          </div>

          {/* Reglas a mejorar: los errores gramaticales de la semana */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 pt-4">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Reglas a mejorar</p>
            {report.errors.top.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {report.errors.top.map(item => (
                  <span
                    key={item.type}
                    className="rounded-full border border-coral/30 bg-coral/5 px-2 py-0.5 text-[10px] uppercase tracking-widest text-coral"
                  >
                    {item.label} ×{item.count}
                  </span>
                ))}
                <span className="text-[10px] uppercase tracking-widest text-slate-500">
                  {report.errors.this_week} esta semana ·{' '}
                  {report.errors.delta < 0
                    ? `↓${Math.abs(report.errors.delta)} vs la pasada`
                    : report.errors.delta > 0
                      ? `↑${report.errors.delta} vs la pasada`
                      : 'igual que la pasada'}
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">Sin errores gramaticales esta semana.</p>
            )}
          </div>
        </>
      )}
    </section>
  )
}
