import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { TeacherDashboard } from '@/components/TeacherDashboard'
import { StudentProfileModal } from '@/components/StudentProfileModal'
import { cn } from '@/lib/utils'
import { readJson } from '@/lib/api'
import { 
  ChevronLeft, Plus, Hash, CheckCircle2, 
  Share2, Shield, Building2, Terminal
} from "lucide-react";

interface Group {
  id: string; name: string; access_code: string
  institution_name: string | null; created_at: string
}

export default function GroupDetailPage() {
  const { id: groupId = '' } = useParams()
  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [totalMissions, setTotalMissions] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      fetch(`/api/teachers/groups/${groupId}`).then(readJson),
      fetch(`/api/teachers/groups/${groupId}/students`).then(readJson),
    ]).then(([g, s]) => {
      setGroup(g)
      setTotalMissions(s?.total_missions ?? 0)
      setLoading(false)
    })
  }, [groupId])

  const copyCode = () => {
    if (!group) return
    navigator.clipboard.writeText(group.access_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
        <div className="absolute inset-2 border-4 border-indigo-500/20 border-b-indigo-500 rounded-full animate-spin-reverse delay-150" />
      </div>
      <p className="text-cyan-500 font-mono text-sm animate-pulse tracking-widest">Sincronizando feed del escuadrón...</p>
    </div>
  )
  if (!group) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <Shield className="w-16 h-16 text-slate-800 mb-4" />
      <p className="text-slate-400 font-mono">ENLACE AL ESCUADRÓN PERDIDO. REINTENTE.</p>
      <button onClick={() => navigate(-1)} className="mt-6 text-cyan-400 font-mono text-sm hover:underline">Volver al panel base</button>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.1),rgba(255,255,255,0))] font-sans p-4 sm:p-8">
      {/* Gamified Decorative BG */}
      <div className="fixed inset-0 pointer-events-none grid-background opacity-20" />
      
      <div className="max-w-4xl mx-auto relative z-10 mt-6 md:mt-12 space-y-8">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 glass-effect p-6 rounded-2xl border border-cyan-500/20 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          
          <div className="space-y-3">
             <button 
                onClick={() => navigate(-1)} 
                className="group flex items-center gap-2 text-slate-400 hover:text-cyan-400 mb-2 font-mono text-xs transition-colors uppercase tracking-widest"
              >
                <div className="p-1 rounded bg-slate-900 border border-slate-800 group-hover:border-cyan-500/50 group-hover:bg-cyan-950/30 transition-all">
                  <ChevronLeft className="w-3 h-3" />
                </div>
                Centro de Mando
              </button>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-950/40 rounded-xl border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                <Shield className="w-8 h-8 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-3xl font-tech font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] tracking-tight">
                  {group.name}
                </h1>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="inline-flex items-center gap-1.5 text-slate-400 text-xs font-mono bg-slate-900/50 px-2 py-0.5 rounded border border-slate-800">
                    <Terminal className="w-3 h-3 text-cyan-500" /> ID: {group.id.slice(0,8)}...
                  </span>
                  {group.institution_name && (
                    <span className="inline-flex items-center gap-1.5 text-slate-400 text-xs font-mono bg-slate-900/50 px-2 py-0.5 rounded border border-slate-800">
                      <Building2 className="w-3 h-3 text-emerald-500" /> {group.institution_name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Link 
            to={`/group/${groupId}/assign-mission`}
            className="group relative inline-flex items-center gap-2 px-6 py-3 bg-cyan-600/20 hover:bg-cyan-500/30 border border-cyan-500/50 hover:border-cyan-400 rounded-xl text-cyan-50 font-mono font-bold text-xs uppercase tracking-wider transition-all duration-300 hover:shadow-neon-cyan active:scale-95 w-full md:w-auto justify-center"
          >
            <Plus className="w-4 h-4 text-cyan-400 group-hover:rotate-90 transition-transform" />
            ASIGNAR MISIÓN
            <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
          </Link>
        </div>

        {/* Access code Panel */}
        <div className="glass-effect rounded-2xl p-6 border border-amber-500/20 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 to-orange-500/5 group-hover:to-orange-500/10 transition-colors pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div>
              <p className="text-[10px] text-amber-500 font-mono font-bold tracking-widest uppercase mb-2 flex items-center gap-2">
                <Hash className="w-3.5 h-3.5" /> Clave de Vinculación de Operadores
              </p>
              <span className="inline-block font-mono font-bold text-3xl md:text-5xl tracking-[0.25em] text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.3)] bg-amber-950/30 px-4 py-2 rounded-xl border border-amber-900/50">
                {group.access_code}
              </span>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <button 
                onClick={copyCode}
                className={cn(
                  'flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-mono font-bold text-xs uppercase transition-all duration-300',
                  copied 
                    ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                    : 'bg-slate-900 border border-slate-700 text-slate-300 hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-950/30'
                )}
              >
                {copied ? <><CheckCircle2 className="w-4 h-4" /> ASEGURADO</> : <><Terminal className="w-4 h-4" /> COPIAR CLAVE</>}
              </button>
              
              <button 
                onClick={() => {
                  const text = `Sistema Lingora: Te han asignado al escuadrón. Código de acceso: ${group.access_code}`
                  if (navigator.share) navigator.share({ title: 'Únete a Lingora', text })
                  else copyCode()
                }} 
                className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-950/30 transition-all active:scale-95 flex-shrink-0"
                title="Compartir Terminal"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Sub-ashboard Component */}
        <TeacherDashboard
          groupId={groupId}
          groupName={group.name}
          totalMissions={totalMissions}
          onViewStudent={setSelectedStudentId}
        />

        {selectedStudentId && (
          <StudentProfileModal studentId={selectedStudentId} groupId={groupId} onClose={() => setSelectedStudentId(null)} />
        )}
      </div>
    </div>
  )
}
