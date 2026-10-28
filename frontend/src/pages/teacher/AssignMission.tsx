import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { readJson } from '@/lib/api'

interface Mission { id: string; title: string; cefr_level: string; base_duration_seconds: number }
const LEVEL_COLORS: Record<string, string> = { A1:'text-emerald', A2:'text-cyan', B1:'text-amber', B2:'text-violet', C1:'text-coral' }

export default function AssignMissionPage() {
  const { id: groupId = '' } = useParams()
  const [missions, setMissions] = useState<Mission[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/missions').then(readJson).then(d => { setMissions(d?.missions ?? []); setLoading(false) })
  }, [])

  const toggle = (id: string) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const handleAssign = async () => {
    if (!selected.length) return
    setSubmitting(true)
    await Promise.all(selected.map(mid =>
      fetch(`/api/teachers/groups/${groupId}/assign-mission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mission_id: mid, due_date: dueDate || null }),
      })
    ))
    navigate(`/group/${groupId}`)
  }

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.1),rgba(255,255,255,0))] font-sans p-6 max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="text-slate-light hover:text-foreground mb-4 text-sm">← ABORTAR_OPERACIÓN</button>
      <h1 className="font-display text-xl font-bold mb-1">DESPLIEGUE TÁCTICO DE MISIONES</h1>
      <p className="text-xs text-slate-light mb-5">Seleccione los módulos de entrenamiento para el escuadrón activo. Se requiere autorización de mando.</p>

      <div className="bg-slate-900/80 border border-cyan-500/30 rounded-xl p-5 mb-6 shadow-[0_0_15px_rgba(6,182,212,0.1)] backdrop-blur-sm">
        <label className="text-xs text-slate-light block mb-2">Fecha límite (opcional)</label>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-amber/50 transition-all" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {missions.map(m => (
            <button key={m.id} onClick={() => toggle(m.id)}
              className={cn('w-full bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 text-left transition-all hover:bg-slate-800 hover:border-cyan-500/50 group', selected.includes(m.id) ? 'border-amber/40 bg-amber/5' : 'hover:bg-white/5')}>
              <div className="flex items-center gap-3">
                <div className={cn('w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center',
                  selected.includes(m.id) ? 'bg-cyan-500 border-cyan-400 text-slate-900 shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'border-white/30')}>
                  {selected.includes(m.id) && <span className="text-xs">✓</span>}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-[10px] font-mono font-semibold', LEVEL_COLORS[m.cefr_level])}>{m.cefr_level}</span>
                    <span className="text-sm font-tech font-bold text-slate-200 group-hover:text-cyan-400 transition-colors">{m.title}</span>
                  </div>
                </div>
                <span className="text-xs text-slate/50 font-mono flex-shrink-0">{Math.floor(m.base_duration_seconds / 60)}min</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <button onClick={handleAssign} disabled={!selected.length || submitting}
        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white shadow-neon-cyan border border-cyan-400 font-display font-semibold py-4 rounded-2xl hover:bg-amber-light transition-all active:scale-[0.98] disabled:opacity-40">
        {submitting ? 'Asignando...' : `Asignar ${selected.length > 0 ? `${selected.length} misión${selected.length > 1 ? 'es' : ''}` : 'misiones'} →`}
      </button>
    </div>
  )
}
