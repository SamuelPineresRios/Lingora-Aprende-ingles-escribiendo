import { Link } from 'react-router-dom'
import { GUEST_TRIAL_SUBMISSIONS } from '@vox/shared'
import { ArrowRight, Sparkles, UserPlus } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'

/** Bienvenida del modo invitado en Misiones. */
export function GuestTrialBanner() {
  const { user } = useAuth()
  if (!user?.is_guest) return null

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-amber/35 bg-[linear-gradient(120deg,rgba(245,158,11,0.14),rgba(2,6,23,0.4))]">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-amber">
            <Sparkles className="h-3.5 w-3.5" /> Modo invitado · prueba gratis
          </p>
          <p className="mt-1.5 text-sm text-white">
            Mira el sistema y juega <span className="font-bold text-amber">{GUEST_TRIAL_SUBMISSIONS} misiones de prueba</span>.
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Al crear tu cuenta conservas tu progreso, empiezas a generar XP y subes de nivel.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            to="/signup"
            className="flex items-center gap-1.5 rounded-xl bg-amber px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-slate-950 transition-colors hover:bg-amber-300"
          >
            <UserPlus className="h-4 w-4" /> Crear cuenta
          </Link>
          <Link
            to="/login"
            className="flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2.5 text-[10px] uppercase tracking-widest text-slate-400 transition-colors hover:border-white/30 hover:text-white"
          >
            Ya tengo cuenta <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}
