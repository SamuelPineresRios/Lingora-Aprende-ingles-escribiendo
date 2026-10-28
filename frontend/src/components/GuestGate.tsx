import { Link } from 'react-router-dom'
import { LockKeyhole, Sparkles } from 'lucide-react'

/** Sección reservada a cuentas reales (ranking, amigos, grupos). */
export function GuestGate() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-amber/30 bg-slate-950/70 p-8 text-center backdrop-blur-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber/40 bg-amber/10">
          <LockKeyhole className="h-6 w-6 text-amber" />
        </div>
        <h1 className="font-body text-2xl font-bold text-white">Esta sección es para cuentas</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Has entrado en modo invitado. Crea tu cuenta gratis para desbloquear el ranking, los amigos y los grupos, y
          conservar todo lo que has practicado.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            to="/signup"
            className="flex items-center justify-center gap-2 rounded-xl bg-amber px-4 py-3 text-sm font-black uppercase tracking-widest text-slate-950 transition-colors hover:bg-amber-300"
          >
            <Sparkles className="h-4 w-4" /> Crear mi cuenta
          </Link>
          <Link
            to="/missions"
            className="rounded-xl border border-white/10 px-4 py-2.5 text-xs uppercase tracking-widest text-slate-400 transition-colors hover:border-white/30 hover:text-white"
          >
            Volver a misiones
          </Link>
        </div>
        <p className="mt-4 text-[10px] uppercase tracking-widest text-slate-600">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-cyan hover:text-cyan-300">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
