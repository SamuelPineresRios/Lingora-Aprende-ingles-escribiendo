import { Link } from 'react-router-dom'
import { GUEST_TRIAL_SUBMISSIONS } from '@vox/shared'
import { cn } from '@/lib/utils'

/**
 * Aviso de fin de la prueba. `compact` es la franja dentro del chat; sin
 * `compact`, la tarjeta del error de arranque con el mensaje del servidor.
 */
export function GuestLimitNotice({ message, compact = false }: { message?: string; compact?: boolean }) {
  if (compact) {
    return (
      <div className="mx-4 mb-2 rounded-xl border border-amber/40 bg-amber/10 px-3 py-2.5 text-center text-[11px] leading-relaxed text-amber">
        Has usado tus {GUEST_TRIAL_SUBMISSIONS} misiones de prueba.{' '}
        <Link to="/signup" className="font-bold underline underline-offset-2">
          Crea tu cuenta gratis
        </Link>{' '}
        para seguir y ganar XP.
      </div>
    )
  }

  return (
    <div
      className={cn(
        'mx-auto max-w-md rounded-xl border border-amber/40 bg-amber/10 px-4 py-4 text-center',
        'space-y-2 text-sm text-amber-100',
      )}
    >
      <p>{message ?? `Has usado tus ${GUEST_TRIAL_SUBMISSIONS} misiones de prueba.`}</p>
      <Link
        to="/signup"
        className="inline-flex rounded-lg bg-amber px-4 py-2 text-[11px] font-black uppercase tracking-widest text-slate-950 transition-colors hover:bg-amber-300"
      >
        Crear cuenta gratis
      </Link>
    </div>
  )
}
