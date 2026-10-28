import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hash, ShieldCheck, AlertCircle, ChevronLeft } from 'lucide-react'
import { readJson } from '@/lib/api'

export default function JoinGroupPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()
  
  const handleJoin = async () => {
    if (!code.trim()) return
    setLoading(true); setError('')
    const res = await fetch('/api/students/join-group', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ access_code: code.trim().toUpperCase() }) })
    const data = await readJson(res)
    if (!res.ok) { setError(data?.error ?? 'ENLACE RECHAZADO'); setLoading(false); return }
    setSuccess(`¡VINCULACIÓN A "${data?.name ?? "EL GRUPO"}" EXITOSA!`)
    // Redirect to missions after 1 second
    setTimeout(() => {
      localStorage.setItem('speak:last-route', '/missions')
      navigate('/missions')
    }, 1000)
  }
  
  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.1),rgba(255,255,255,0))] font-sans flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Gamified Decorative BG */}
      <div className="fixed inset-0 pointer-events-none grid-background opacity-20" />
      
      <div className="w-full max-w-sm relative z-10 space-y-6 animate-fade-in-up">
        
        <div className="text-center mb-8">
          <div className="inline-flex justify-center items-center w-16 h-16 rounded-2xl bg-cyan-950/50 border border-cyan-500/30 mb-6 shadow-neon-cyan">
             <Hash className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-tech font-bold text-white drop-shadow-[0_0_10px_rgba(34,211,238,0.3)] tracking-tight">VINCULACIÓN DE ESCUADRÓN</h1>
          <p className="text-xs font-mono text-slate-400 mt-3 uppercase tracking-widest">Ingrese la clave de cifrado táctica</p>
        </div>

        <div className="glass-effect rounded-2xl p-6 md:p-8 space-y-5 border border-cyan-500/20 relative">
          {/* Top glow */}
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />
          
          <div className="space-y-3">
             <label className="text-[10px] text-cyan-500 font-mono font-bold uppercase tracking-widest block px-1">CLAVE RECIBIDA</label>
             <input 
                type="text" 
                placeholder="EJ: ALPH24" 
                value={code} 
                onChange={e=>setCode(e.target.value.toUpperCase())} 
                onKeyDown={e=>e.key==='Enter'&&handleJoin()} 
                maxLength={8} 
                className="w-full bg-slate-900/80 border border-slate-700/50 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 rounded-xl px-4 py-4 text-white text-center text-3xl font-mono font-bold tracking-[0.3em] placeholder:text-slate-700 placeholder:text-xl placeholder:tracking-normal transition-all uppercase"
             />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-red-400 text-xs font-mono">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> <span className="uppercase">{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" /> <span className="uppercase">{success}</span>
            </div>
          )}

          <button 
            onClick={handleJoin} 
            disabled={!code.trim()||loading} 
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold py-4 rounded-xl transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed border border-cyan-400 hover:shadow-neon-cyan flex items-center justify-center gap-2 text-sm tracking-widest"
          >
            {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> VERIFICANDO...
                </>
            ) : 'AUTORIZAR ENLACE'}
          </button>
        </div>
        
        <button onClick={()=>navigate(-1)} className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-cyan-400 text-xs font-mono uppercase tracking-widest py-4 transition-colors">
            <ChevronLeft className="w-4 h-4" /> ABORTAR
        </button>
      </div>
    </div>
  )
}
