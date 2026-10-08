import { useEffect, useState, useCallback, useRef } from 'react'
import { cn, formatDuration } from '@/lib/utils'
import { 
  Users, Activity, Target, ChevronDown, ChevronUp, AlertTriangle, Clock, ShieldCheck, Download
} from "lucide-react";
import { readJson } from '@/lib/api'

interface StudentProgress {
  student_id: string
  full_name: string | null
  email: string
  missions_completed: number
  total_missions: number
  writing_time_seconds: number
  avg_comprehensibility: number | null
  /** Totales de toda la app (no solo del grupo) y última actividad. */
  xp_total: number
  last_activity_at: string | null
  inactive_days: number | null
}

interface TeacherDashboardProps {
  groupId: string
  groupName: string
  totalMissions: number
  onViewStudent: (studentId: string) => void
}

export function TeacherDashboard({ groupId, onViewStudent }: TeacherDashboardProps) {
  const [students, setStudents] = useState<StudentProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'name' | 'missions' | 'time'>('missions')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchStudents = useCallback(async () => {
    const res = await fetch(`/api/teachers/groups/${groupId}/students`)
    if (res.ok) {
      const data = await readJson(res)
      setStudents(data?.students ?? [])
      if (loading) setLoading(false)
    }
  }, [groupId, loading])

  useEffect(() => {
    fetchStudents()
    pollRef.current = setInterval(fetchStudents, 10000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [groupId, fetchStudents]) 

  const sorted = [...students].sort((a, b) => {
    let val = 0
    if (sortBy === 'name') val = (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email)
    if (sortBy === 'missions') val = a.missions_completed - b.missions_completed
    if (sortBy === 'time') val = a.writing_time_seconds - b.writing_time_seconds
    return sortDir === 'desc' ? -val : val
  })

  const inactivos = students.filter(s => s.inactive_days !== null && s.inactive_days >= 7).length
  const groupAvg = students.filter(s => s.avg_comprehensibility !== null).length > 0
    ? students.reduce((sum, s) => sum + (s.avg_comprehensibility ?? 0), 0) / students.length
    : null

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const SortIcon = ({ col }: { col: typeof sortBy }) => {
    if (sortBy !== col) return <ChevronDown className="w-3 h-3 opacity-20" />
    return sortDir === 'desc' ? <ChevronDown className="w-3 h-3 text-cyan-400" /> : <ChevronUp className="w-3 h-3 text-cyan-400" />
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-12 glass-effect rounded-2xl border border-slate-800">
      <div className="relative w-12 h-12 mb-4">
        <div className="absolute inset-0 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
      </div>
      <p className="font-mono text-cyan-500 text-xs tracking-widest animate-pulse">RECOPILANDO DATOS DE OPERADORES...</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Stats summary - Cyberpunk Panels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Operatives */}
        <div className="glass-effect rounded-xl p-5 border border-slate-800 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users className="w-16 h-16 text-cyan-500" />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-mono text-cyan-500 font-bold tracking-widest mb-1">OPERADORES</p>
            <p className="text-4xl font-tech font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
              {students.length}
            </p>
          </div>
        </div>

        {/* Active Agents */}
        <div className="glass-effect rounded-xl p-5 border border-slate-800 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity className="w-16 h-16 text-amber-500" />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-mono text-amber-500 font-bold tracking-widest mb-1">ACTIVOS EN CAMPO</p>
            <p className="text-4xl font-tech font-bold text-amber-400 shadow-neon-amber-text">
              {students.filter(s => s.missions_completed > 0).length}
            </p>
          </div>
        </div>

        {/* Avg Clarity */}
        <div className="glass-effect rounded-xl p-5 border border-slate-800 relative overflow-hidden group">
          <div className="absolute right-0 top-1/2 -translate-y-1/2 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Target className="w-16 h-16 text-emerald-500" />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-mono text-slate-400 font-bold tracking-widest mb-1 uppercase">Precisión Táctica</p>
            <p className={cn(
              'text-4xl font-tech font-bold',
              groupAvg !== null ? (groupAvg >= 80 ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]' : groupAvg >= 65 ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'text-coral') : 'text-slate-600'
            )}>
              {groupAvg !== null ? `${Math.round(groupAvg)}%` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Operative Roster Table */}
      <div className="glass-effect rounded-2xl overflow-hidden border border-slate-700/50">
        <div className="bg-slate-900/80 px-4 py-3 border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-2">
           <div className="flex items-center gap-2">
             <ShieldCheck className="w-4 h-4 text-cyan-500" />
             <h3 className="font-mono text-sm font-bold text-slate-200 tracking-widest">REGISTRO DE OPERADORES</h3>
           </div>
           <div className="flex items-center gap-3">
             {inactivos > 0 && (
               <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-amber-950/40 text-amber-400 px-2 py-1 rounded border border-amber-900/50">
                 <Clock className="w-3 h-3" /> {inactivos} SIN PRACTICAR
               </span>
             )}
             <a
               href={`/api/teachers/groups/${groupId}/report.csv`}
               className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-400 hover:text-cyan-300 bg-cyan-950/30 border border-cyan-500/40 rounded-lg px-3 py-1.5 transition-colors"
             >
               <Download className="w-3 h-3" /> Informe CSV
             </a>
           </div>
        </div>
        
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-3 border-b border-slate-800 bg-slate-950/50">
          {(['name', 'missions', 'time'] as const).map(col => (
            <button key={col} onClick={() => toggleSort(col)}
              className={cn(
                "text-[10px] font-mono font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors text-left",
                sortBy === col ? "text-cyan-400" : "text-slate-500 hover:text-slate-300"
              )}>
              {col === 'name' ? 'Identificación' : col === 'missions' ? 'Misiones' : 'Tiempo en Red'}
              <SortIcon col={col} />
            </button>
          ))}
        </div>

        <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
          {sorted.length === 0 ? (
            <div className="px-6 py-16 flex flex-col items-center justify-center text-center">
              <Users className="w-12 h-12 text-slate-700 mb-3" />
              <p className="text-slate-400 font-mono text-sm">NO HAY SEÑALES DETECTADAS.</p>
              <p className="text-slate-500 font-sans text-xs mt-1">Comparte la clave de acceso para reclutar escuadrón.</p>
            </div>
          ) : sorted.map(student => {
            const isLow = groupAvg !== null && student.avg_comprehensibility !== null
              && student.avg_comprehensibility < groupAvg * 0.5
              
            return (
              <button 
                key={student.student_id} 
                onClick={() => onViewStudent(student.student_id)}
                className={cn(
                  'w-full grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-4 border-b border-slate-800/50 last:border-0 hover:bg-slate-800/40 transition-all text-left group', 
                  isLow ? 'bg-red-950/20 hover:bg-red-900/30' : ''
                )}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center text-sm font-tech font-bold flex-shrink-0 transition-transform group-hover:scale-110 shadow-lg',
                    isLow 
                      ? 'bg-red-950/50 text-red-500 border border-red-500/50 shadow-neon-coral' 
                      : student.missions_completed > 0 
                        ? 'bg-cyan-950/50 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.1)]'
                        : 'bg-slate-900 text-slate-500 border border-slate-800'
                  )}>
                    {(student.full_name ?? student.email)[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-200 font-bold truncate tracking-wide font-sans group-hover:text-white transition-colors">
                      {student.full_name ?? student.email.split('@')[0]}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] text-slate-500 font-mono truncate">{student.email}</p>
                      {isLow && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-mono bg-red-950/50 text-red-400 px-1.5 py-0.5 rounded border border-red-900/50 whitespace-nowrap">
                          <AlertTriangle className="w-2.5 h-2.5" /> SOPORTE TÁCTICO REQUERIDO
                        </span>
                      )}
                      {student.inactive_days !== null && student.inactive_days >= 7 && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-mono bg-amber-950/50 text-amber-400 px-1.5 py-0.5 rounded border border-amber-900/50 whitespace-nowrap">
                          <Clock className="w-2.5 h-2.5" /> INACTIVO {student.inactive_days} D
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="text-right flex items-center justify-end">
                  <div className="px-3 py-1 rounded-md bg-slate-900/60 border border-slate-800">
                    <p className="text-sm font-mono font-bold">
                      <span className={student.missions_completed > 0 ? 'text-amber-400 text-base shadow-neon-amber-text' : 'text-slate-600'}>
                        {student.missions_completed}
                      </span>
                      <span className="text-slate-600 px-1">/</span>
                      <span className="text-slate-400">{student.total_missions}</span>
                    </p>
                  </div>
                </div>
                
                <div className="text-right flex items-center justify-end text-slate-400">
                  <div className="flex items-center gap-1.5 text-xs font-mono bg-slate-900/40 px-2 py-1.5 rounded-md border border-slate-800 group-hover:border-slate-700 transition-colors">
                     <Clock className="w-3 h-3 text-slate-500" />
                     {formatDuration(student.writing_time_seconds)}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
      
      <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 font-mono tracking-widest uppercase">
         <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-pulse" />
         Enlace satelital continuo (Renovación 10s)
      </div>
    </div>
  )
}
