import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/hooks/useAuth'
import { readJson } from '@/lib/api'
import { cn } from '@/lib/utils'
import { 
  Terminal, Cpu, Plus, 
  Play, Users, Hash, CheckCircle2, ChevronRight, LogOut 
} from "lucide-react";

interface Group { id:string; name:string; access_code:string; institution_name:string|null }

export default function TeacherDashboardPage() {
  const { user, logout } = useAuth()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string|null>(null)

  useEffect(() => { 
    fetch('/api/teachers/groups')
      .then(readJson)
      .then(d => { setGroups(d?.groups??[]); setLoading(false) }) 
  }, [])

  const copyCode = (code:string) => { 
    navigator.clipboard.writeText(code); 
    setCopied(code); 
    setTimeout(()=>setCopied(null), 2000) 
  }

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.1),rgba(255,255,255,0))] font-sans p-4 sm:p-8">
      {/* Gamified Decorative BG */}
      <div className="fixed inset-0 pointer-events-none grid-background opacity-20" />
      
      <div className="max-w-4xl mx-auto relative z-10 space-y-8 mt-12">
        {/* Header - Command Center */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 glass-effect p-6 rounded-2xl border border-cyan-500/20">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2 py-1 rounded bg-cyan-950/50 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono font-bold tracking-widest uppercase mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-neon" />
              Credenciales de Docente Verificadas
            </div>
            <h1 className="text-4xl font-tech font-bold text-white drop-shadow-[0_0_15px_rgba(34,211,238,0.4)] tracking-tight">
              CENTRO DE MANDO
            </h1>
            <p className="text-slate-400 font-mono text-sm flex items-center gap-2 mt-1">
              <Terminal className="w-3.5 h-3.5" /> Admin Raíz: <span className="text-cyan-300 shadow-neon-cyan/20 px-2 py-0.5 rounded bg-cyan-950/30 border border-cyan-900/50">{user?.email}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <Link 
              to="/group/create" 
              className="group relative inline-flex items-center gap-2 px-6 py-3 bg-cyan-600/20 hover:bg-cyan-500/30 border border-cyan-500/50 hover:border-cyan-400 rounded-xl text-cyan-50 font-mono font-bold text-xs uppercase tracking-wider transition-all duration-300 hover:shadow-neon-cyan active:scale-95"
            >
              <Plus className="w-4 h-4 text-cyan-400 group-hover:rotate-90 transition-transform" />
              CREAR ESCUADRÓN
              <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform" />
            </Link>
            <button 
              onClick={logout} 
              className="p-3 rounded-xl border border-red-500/20 hover:border-red-500/50 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all active:scale-95 group"
              title="Cerrar Sesión"
            >
              <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 glass-effect border border-slate-800 rounded-2xl">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
              <div className="absolute inset-2 border-4 border-indigo-500/20 border-b-indigo-500 rounded-full animate-spin-reverse delay-150" />
            </div>
            <p className="mt-4 text-cyan-500 font-mono text-sm animate-pulse">ESTABLECIENDO CONEXIÓN CON LA BASE DE DATOS...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 glass-effect border border-cyan-500/20 rounded-2xl text-center relative overflow-hidden group">
            <Cpu className="w-16 h-16 text-slate-600 mb-4 group-hover:text-cyan-500/50 transition-colors" />
            <h3 className="text-xl font-tech text-white mb-2">NO SE ENCONTRARON ESCUADRONES ACTIVOS</h3>
            <p className="text-slate-400 font-mono text-sm mb-8 max-w-md mx-auto">Inicialice su primer grupo de mando para desplegar misiones y monitorear a los estudiantes operativos.</p>
            <Link 
              to="/group/create" 
              className="inline-flex items-center gap-2 px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-sm tracking-wider rounded-lg transition-all hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] active:scale-95"
            >
              INICIALIZAR PROTOCOLO <Play className="w-4 h-4 fill-current" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-2">
              <Users className="w-5 h-5 text-indigo-400" />
              <h2 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-widest">Escuadrones Activos Desplegados</h2>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-slate-800 to-transparent" />
            </div>
            
             <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {groups.map((g: Group) => (
                <div key={g.id} className="group relative glass-effect rounded-2xl p-6 border border-slate-700/50 hover:border-cyan-500/50 transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 to-indigo-500/0 group-hover:from-cyan-500/5 group-hover:to-indigo-500/5 transition-colors" />
                  
                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-2xl font-bold text-white group-hover:text-cyan-300 transition-colors flex items-center gap-2 tracking-tight">
                          {g.name}
                        </h3>
                        {g.institution_name && (
                          <div className="inline-flex mt-2 px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono uppercase border border-slate-700">
                            {g.institution_name}
                          </div>
                        )}
                      </div>
                      <Link 
                        to={`/group/${g.id}`} 
                        className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-cyan-500 hover:text-white transition-all ml-4 shrink-0 shadow-lg border border-slate-700 hover:border-cyan-400"
                        title="Ver Panel"
                      >
                       <ChevronRight className="w-5 h-5 relative left-px" />
                      </Link>
                    </div>

                    <div className="mt-auto pt-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 gap-3">
                        <div className="flex items-center gap-2 text-slate-400 text-xs font-mono font-semibold">
                          <Hash className="w-4 h-4 text-amber-500" />
                          CLAVE_ACCESO
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-amber-400 tracking-widest drop-shadow-[0_0_5px_rgba(251,191,36,0.3)] text-xl bg-amber-950/20 px-2 rounded border border-amber-900/30">
                            {g.access_code}
                          </span>
                          <button 
                            onClick={()=>copyCode(g.access_code)} 
                            className={cn(
                              'px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase transition-all whitespace-nowrap', 
                              copied === g.access_code 
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]' 
                                : 'bg-slate-800 text-slate-400 hover:text-cyan-300 hover:bg-cyan-950 border border-slate-700'
                            )}
                          >
                            {copied === g.access_code ? (
                              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> COPIADA</span>
                            ) : 'COPIAR CLAVE'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
