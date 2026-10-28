import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { 
  ShieldCheck, 
  Terminal, 
  ChevronLeft,
  Server,
  Building2,
  AlertCircle,
  Check
} from "lucide-react";
import { readJson } from '@/lib/api'

export default function CreateGroupPage() {
  const [name, setName] = useState('')
  const [institution, setInstitution] = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleCreate = async () => {
    if (!name.trim()) { setError('El nombre del escuadrón es requerido'); return }
    if (!consent) { setError('Falta confirmación de protocolo de seguridad (consentimiento)'); return }
    setLoading(true); setError('')

    const res = await fetch('/api/teachers/groups/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), institution_name: institution.trim() || null, parental_consent_confirmed: true }),
    })
    const data = await readJson(res)
    if (!res.ok) { setError(data?.error ?? 'Fallo en la creación del escuadrón'); setLoading(false); return }
    navigate(`/group/${data?.id}`)
  }

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.1),rgba(255,255,255,0))] font-sans p-4 sm:p-8">
      {/* Gamified Decorative BG */}
      <div className="fixed inset-0 pointer-events-none grid-background opacity-20" />
      
      <div className="max-w-xl mx-auto relative z-10 mt-12 mb-20">
        <button 
          onClick={() => navigate(-1)} 
          className="group flex items-center gap-2 text-slate-400 hover:text-cyan-400 mb-8 font-mono text-sm transition-colors"
        >
          <div className="p-1 rounded-md bg-slate-900 border border-slate-800 group-hover:border-cyan-500/50 group-hover:bg-cyan-950/30 transition-all">
            <ChevronLeft className="w-4 h-4" />
          </div>
          RETORNAR AL CENTRO DE MANDO
        </button>

        <div className="glass-effect rounded-2xl border border-cyan-500/20 p-6 md:p-8 relative overflow-hidden">
          {/* Top Edge Glow */}
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />
          
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-cyan-950/50 rounded-xl border border-cyan-500/30 shadow-neon-cyan">
              <Server className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-tech font-bold text-white drop-shadow-[0_0_15px_rgba(34,211,238,0.4)] tracking-tight">
                INICIALIZAR ESCUADRÓN
              </h1>
              <p className="text-slate-400 font-mono text-xs uppercase tracking-widest mt-1 flex items-center gap-1.5">
                <Terminal className="w-3 h-3" />
                Configuración de base de datos
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <div className="relative group">
                <label className="text-[10px] text-cyan-500 font-mono font-bold uppercase tracking-widest block mb-2 px-1">
                  Designación del Escuadrón *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-slate-500 font-mono text-lg">_</span>
                  </div>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="ej: Escuadrón Alpha 6"
                    className="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl pl-10 pr-4 py-3.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono text-sm" 
                  />
                </div>
              </div>

              <div className="relative group">
                <label className="text-[10px] text-cyan-500 font-mono font-bold uppercase tracking-widest block mb-2 px-1">
                  Registro Institucional <span className="text-slate-500">(Opcional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Building2 className="w-4 h-4 text-slate-500" />
                  </div>
                  <input 
                    type="text" 
                    value={institution} 
                    onChange={e => setInstitution(e.target.value)} 
                    placeholder="ej: Academia Sector 4"
                    className="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl pl-10 pr-4 py-3.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono text-sm" 
                  />
                </div>
              </div>
            </div>

            <div 
              onClick={() => setConsent(!consent)}
              className={cn(
                'rounded-xl p-4 border transition-all duration-300 cursor-pointer relative overflow-hidden group', 
                consent 
                  ? 'border-emerald-500/50 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                  : 'border-slate-700/50 bg-slate-900/50 hover:bg-slate-800'
              )}
            >
              {consent && <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 pointer-events-none" />}
              <div className="flex items-start gap-4 relative z-10">
                <div className={cn(
                  'w-6 h-6 rounded border flex-shrink-0 flex items-center justify-center mt-0.5 transition-all duration-300',
                  consent 
                    ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.5)]' 
                    : 'bg-slate-900 border-slate-600 text-transparent group-hover:border-slate-500'
                )}>
                  <Check className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <h4 className={cn("text-sm font-bold font-mono tracking-wide mb-1 transition-colors", consent ? "text-emerald-400" : "text-slate-300")}>
                    PROTOCOLO DE SEGURIDAD
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-sans">
                    Confirmo que poseo <strong>autorización institucional y parental</strong> certificada para registrar operadores en este cuadrante.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-950/30 border border-red-500/30 text-red-400 text-sm font-mono">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="pt-4">
              <button 
                onClick={handleCreate} 
                disabled={loading || !name.trim() || !consent}
                className={cn(
                  "relative w-full group overflow-hidden font-mono font-bold text-sm tracking-widest py-4 rounded-xl transition-all duration-300",
                  loading || !name.trim() || !consent
                    ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                    : "bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.4)] active:scale-[0.98]"
                )}
              >
                {!(loading || !name.trim() || !consent) && (
                  <>
                    <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] animate-shimmer opacity-0 group-hover:opacity-100" />
                    <div className="absolute inset-0 shadow-[inset_0_0_10px_rgba(255,255,255,0.2)] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  </>
                )}
                
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ESCANEO EN PROGRESO...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      AUTORIZAR DESPLIEGUE
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
