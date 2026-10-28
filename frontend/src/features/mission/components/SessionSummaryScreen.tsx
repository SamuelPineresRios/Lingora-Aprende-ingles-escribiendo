import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { formatTime, formatDuration, cn } from '@/lib/utils'
import { readJson } from '@/lib/api'

interface WeeklyStat { week_start_date: string; missions_completed: number; writing_time_seconds: number; avg_comprehensibility: number | null }
interface SessionData {
  today_writing_seconds: number; week_writing_seconds: number
  missions_completed_this_week: number; avg_comprehensibility: number | null
  top_structures: { structure: string; count: number }[]
  actionable_suggestion: string; week_start_date: string
}

export function SessionSummaryScreen({ studentId }: { studentId: string }) {
  const [session, setSession] = useState<SessionData | null>(null)
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStat[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      fetch(`/api/students/${studentId}/session-summary`).then(readJson),
      fetch(`/api/students/${studentId}/weekly-stats`).then(readJson),
    ]).then(([s, w]) => { setSession(s); setWeeklyStats(w?.weekly_stats ?? []); setLoading(false) })
  }, [studentId])

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-amber/30 border-t-amber rounded-full animate-spin"/></div>
  if (!session) return null

  const chartData = [...weeklyStats].reverse().map((w, i) => ({ week: `S${i+1}`, clarity: w.avg_comprehensibility ?? 0 }))

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto px-4 py-8 space-y-5">
      <div className="animate-fade-in-up">
        <p className="text-xs text-amber font-medium uppercase tracking-wider mb-1">Sesión completada</p>
        <h1 className="font-display text-2xl font-bold">Tu progreso de hoy</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-2xl p-4">
          <p className="text-xs text-slate-light mb-1">Hoy escribiste</p>
          <p className="font-display text-2xl font-bold">{formatTime(session.today_writing_seconds)}</p>
          <p className="text-xs text-slate-light mt-0.5">en inglés</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-xs text-slate-light mb-1">Esta semana</p>
          <p className="font-display text-2xl font-bold text-amber">{formatDuration(session.week_writing_seconds)}</p>
          <p className="text-xs text-slate-light mt-0.5">acumulados</p>
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-light mb-1">Misiones completadas esta semana</p>
            <p className="font-display text-3xl font-bold">{session.missions_completed_this_week}</p>
          </div>
          {session.avg_comprehensibility !== null && (
            <div className="text-right">
              <p className="text-xs text-slate-light mb-1">Claridad promedio</p>
              <p className={cn('font-display text-2xl font-bold',
                session.avg_comprehensibility >= 80 ? 'text-emerald' : session.avg_comprehensibility >= 65 ? 'text-amber' : 'text-coral')}>
                {Math.round(session.avg_comprehensibility)}%
              </p>
            </div>
          )}
        </div>
      </div>

      {chartData.some(d => d.clarity > 0) && (
        <div className="glass rounded-2xl p-4">
          <p className="text-xs text-slate-light uppercase tracking-wider mb-3">Evolución — últimas 4 semanas</p>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1C2430', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(v: number) => [`${Math.round(v)}%`, 'Claridad']} />
                <Line type="monotone" dataKey="clarity" stroke="#F59E0B" strokeWidth={2} dot={{ fill: '#F59E0B', r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-amber/10 border border-amber/20 rounded-2xl p-4">
        <p className="text-xs text-amber uppercase tracking-wider mb-2 font-medium">→ Sugerencia para tu próxima sesión</p>
        <p className="text-sm text-foreground/90 leading-relaxed">{session.actionable_suggestion}</p>
      </div>

      {session.top_structures.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <p className="text-xs text-slate-light uppercase tracking-wider mb-3">Estructuras que más usaste</p>
          <div className="space-y-2">
            {session.top_structures.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-1.5 bg-emerald/60 rounded-full" style={{ width: `${(s.count / (session.top_structures[0]?.count ?? 1)) * 100}%`, minWidth: '20px' }} />
                <span className="text-xs font-mono text-slate-lighter flex-shrink-0">{s.structure} <span className="text-slate/50">×{s.count}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3 pt-2">
        <button onClick={() => navigate('/missions')}
          className="w-full bg-amber text-midnight-50 font-display font-semibold py-4 rounded-2xl hover:bg-amber-light transition-all shadow-lg shadow-amber/20 active:scale-[0.98]">
          Seguir practicando →
        </button>
      </div>
    </div>
  )
}
