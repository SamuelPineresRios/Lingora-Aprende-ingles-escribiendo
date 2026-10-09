import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Clock, AlertCircle, PlayCircle, Trophy, Target, Award, ShieldAlert, Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ModuleBackdrop } from '@/components/ModuleBackdrop'
import { readJson } from '@/lib/api'

export default function StudentGroupsPage() {
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
    const navigate = useNavigate()

  useEffect(() => {
    fetchGroups()
  }, [])

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/students/groups')
      if (!res.ok) throw new Error('ERROR AL SINCRONIZAR ESCUADRONES')
      const data = await readJson(res)
      setGroups(data?.groups ?? [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center relative">
        <ModuleBackdrop />
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
          <p className="text-cyan-500 font-mono text-xs tracking-[0.2em] animate-pulse">RASTREANDO ESCUADRONES...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-[100vh] w-full bg-black/90">
      <ModuleBackdrop />

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto space-y-8 animate-fade-in pt-16 px-6 lg:px-8 pb-12">
        {/* HEADER */}
        <div className="relative overflow-hidden rounded-2xl bg-black/60 backdrop-blur-md border border-cyan-500/20 p-8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/40 via-transparent to-transparent opacity-50"></div>
        <div className="absolute right-0 top-0 w-64 h-full bg-gradient-to-l from-cyan-500/10 to-transparent"></div>
        
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Cpu className="text-cyan-400 w-6 h-6" />
              <h1 className="text-3xl font-body font-bold text-white tracking-widest drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                MIS ESCUADRONES
              </h1>
            </div>
            <p className="text-cyan-400/60 font-mono text-sm tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              {groups.length} ESCUADRONES ACTIVOS ENLACE RASTREADO
            </p>
          </div>
          
          <button 
            onClick={() => navigate('/join-group')}
            className="flex items-center gap-2 px-6 py-3 bg-cyan-950/50 border border-cyan-500/50 rounded-xl text-cyan-400 hover:bg-cyan-900/50 hover:shadow-neon-cyan transition-all font-mono text-xs tracking-widest"
          >
            <ShieldAlert className="w-4 h-4" />
            VINCULAR CON CÓDIGO
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-mono text-sm">{error}</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
          <div className="w-24 h-24 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center opacity-50">
            <Users className="w-12 h-12 text-slate-600" />
          </div>
          <div className="space-y-2">
            <p className="text-xl font-body text-white tracking-wider">NO ESTÁS EN NINGÚN ESCUADRÓN</p>
            <p className="text-sm font-mono text-slate-500 tracking-widest">
              CONTACTA A TU COMANDANTE PARA OBTENER TUS CÓDIGOS DE ACCESO
            </p>
          </div>
          <button 
            onClick={() => navigate('/join-group')}
            className="mt-6 flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold rounded-xl transition-all active:scale-[0.98] border border-cyan-400 hover:shadow-neon-cyan text-sm tracking-widest"
          >
            <ShieldAlert className="w-5 h-5" />
            VINCULAR CON CÓDIGO AHORA
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {groups.map((group) => (
            <div key={group.id} className="relative group rounded-2xl border border-white/5 bg-black/40 overflow-hidden hover:border-cyan-500/30 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="p-6 relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-body font-bold text-white tracking-wider mb-2">
                      {group.name}
                    </h3>
                    <div className="flex items-center gap-4 text-xs font-mono">
                      <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md border border-emerald-400/20">
                        <Trophy className="w-3.5 h-3.5" />
                        {group.total_points || 0} PTS XP
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Users className="w-3.5 h-3.5" />
                        COMANDANTE: {group.teacher_name || 'DESCONOCIDO'}
                      </span>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center border border-white/10 group-hover:border-cyan-500/50 transition-colors">
                    <Target className="w-6 h-6 text-slate-400 group-hover:text-cyan-400" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-2 border-b border-white/5">
                    <span>OPERACIONES ASIGNADAS</span>
                    <span className="text-cyan-400">{group.assignments?.length || 0} MISIONES</span>
                  </div>

                  {group.assignments && group.assignments.length > 0 ? (
                    <div className="space-y-2 mt-4">
                      {group.assignments.map((assignment: any) => (
                        <div key={assignment.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-cyan-950/20 transition-colors gap-4">
                          <div className="flex items-start gap-3">
                            <Award className="w-5 h-5 text-purple-400 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-bold text-slate-200">{assignment.title}</h4>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className={cn(
                                        "text-[10px] font-mono tracking-widest px-1.5 py-0.5 rounded border",
                                        assignment.status === 'completed' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                        assignment.status === 'in_progress' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                        "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                    )}>
                                        {assignment.status === 'completed' ? 'COMPLETADO' : 
                                         assignment.status === 'in_progress' ? 'EN CURSO' : 'PENDIENTE'}
                                    </span>
                                    {assignment.due_date && (
                                        <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            EXP: {new Date(assignment.due_date).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                          </div>
                          
                          {assignment.status !== 'completed' && (
                             <button
                               onClick={() => navigate(`/mission/${assignment.content_id}?group_id=${group.id}&assignment_id=${assignment.id}`)}
                               className="flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-[10px] tracking-widest font-bold rounded-lg transition-all"
                             >
                               <PlayCircle className="w-3.5 h-3.5" /> EJECUTAR
                             </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-sm font-mono text-slate-500">
                      SIN OPERACIONES PENDIENTES. A LA ESPERA DE ORDENES.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
