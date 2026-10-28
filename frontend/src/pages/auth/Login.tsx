import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { ShieldCheck, UserCircle, KeyRound, AlertCircle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { readJson } from '@/lib/api'
import { useAuth } from '@/lib/hooks/useAuth'

export default function LoginPage() {
  const { user, loading: sessionLoading, refetch } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const submitted = useRef(false)

  // La sesión ya la cargó AuthProvider: aquí solo se decide si se muestra el
  // formulario (sin sesión o invitado) o se vuelve a la última ruta (cuenta real).
  useEffect(() => {
    if (submitted.current || sessionLoading || !user || user.is_guest) return
    navigate(localStorage.getItem('speak:last-route') || '/missions')
  }, [sessionLoading, user, navigate])

  const isChecking = sessionLoading || Boolean(user && !user.is_guest)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    submitted.current = true
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role })
      })
      if (!res.ok) {
        const data = await readJson(res)
        throw new Error(data?.error || 'ACCESO DENEGADO')
      }
      const data = await readJson(res)
      // El contexto de sesión se cargó sin sesión al abrir /login: sin este
      // refresco, ProtectedRoute sigue viendo user=null y rebota a /login.
      await refetch()
      if (data?.user?.role === 'teacher') navigate('/dashboard')
      else navigate('/missions')
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 font-sans flex flex-col justify-center items-center p-6 relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/10 via-slate-900 to-black">
      {/* Show loading while checking session */}
      {isChecking && (
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-3 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          <p className="text-cyan-400 font-mono text-sm tracking-wider">Verificando sesión...</p>
        </div>
      )}

      {/* Show login form if no existing session */}
      {!isChecking && (
        <>
          {/* Decorative Grid */}
          <div className="fixed inset-0 pointer-events-none grid-background opacity-20" />
          
          <div className="w-full max-w-sm relative z-10 space-y-8 animate-fade-in-up">
            
            {/* Header */}
            <div className="text-center">
              <div className="inline-flex justify-center items-center w-16 h-16 rounded-2xl bg-cyan-950/50 border border-cyan-500/30 mb-6 shadow-neon-cyan">
                 <ShieldCheck className="w-8 h-8 text-cyan-400" />
              </div>
              <h1 className="text-3xl font-tech font-bold text-white drop-shadow-[0_0_10px_rgba(34,211,238,0.3)] tracking-tight uppercase">Inicio de sesión</h1>
              <p className="text-xs font-mono text-cyan-500/80 mt-2 tracking-[0.2em] uppercase">Identificación de Operador</p>
            </div>

            {/* Roles Toggle */}
            <div className="flex bg-slate-900/80 p-1.5 rounded-xl border border-slate-700/50 relative overflow-hidden">
              <div className={cn("absolute inset-y-1.5 w-[calc(50%-0.375rem)] bg-cyan-600 rounded-lg transition-transform duration-300 ease-out", role === 'teacher' ? "translate-x-[calc(100%+0.1rem)]" : "translate-x-0" )} />
              <button type="button" onClick={() => setRole('student')} className={cn("flex-1 py-2.5 text-xs font-mono font-bold tracking-widest z-10 transition-colors uppercase", role === 'student' ? "text-white drop-shadow-md" : "text-slate-500 hover:text-slate-300")}> Estudiante </button>
              <button type="button" onClick={() => setRole('teacher')} className={cn("flex-1 py-1.5 text-xs font-mono font-bold tracking-widest z-10 transition-colors uppercase", role === 'teacher' ? "text-white" : "text-slate-500 hover:text-slate-300")}> Profesor </button>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="glass-effect rounded-2xl p-6 md:p-8 space-y-6 border border-cyan-500/20 relative">
              <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />
              
              <div className="space-y-4">
                <div className="group relative">
                   <label className="text-[10px] text-cyan-500 font-mono font-bold uppercase tracking-widest block px-1 mb-1">IDENTIFICADOR (EMAIL)</label>
                   <div className="relative">
                     <UserCircle className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-cyan-400 transition-colors" />
                     <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-slate-900/80 border border-slate-700/50 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 rounded-xl pl-11 pr-4 py-3.5 text-white font-mono placeholder:text-slate-600" placeholder="operador@red.com" />
                   </div>
                </div>

                <div className="group relative">
                   <label className="text-[10px] text-cyan-500 font-mono font-bold uppercase tracking-widest block px-1 mb-1">CONTRASEÑA</label>
                   <div className="relative">
                     <KeyRound className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-cyan-400 transition-colors" />
                     <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-slate-900/80 border border-slate-700/50 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 rounded-xl pl-11 pr-4 py-3.5 text-white font-mono placeholder:text-slate-600" placeholder="••••••••" />
                   </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-red-400 text-xs font-mono">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold py-4 rounded-xl transition-all active:scale-[0.98] disabled:opacity-40 border border-cyan-400 hover:shadow-neon-cyan flex items-center justify-center gap-2 tracking-[0.2em] uppercase text-sm">
                {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <> INICIAR SESIÓN<ChevronRight className="w-4 h-4" /> </>}
              </button>
            </form>

            <div className="space-y-3 text-center">
              <Link to="/signup" className="block text-xs font-mono text-slate-500 hover:text-cyan-400 transition-colors uppercase tracking-widest">
                ¿NO TIENES ACCESO? REGISTRO DE NUEVO OPERADOR
              </Link>
              <Link
                to="/missions"
                className="inline-flex items-center justify-center rounded-xl border border-amber/30 bg-amber/10 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-amber transition-colors hover:bg-amber/20"
              >
                Probar sin cuenta →
              </Link>
            </div>

          </div>
        </>
      )}
    </div>
  )
}
