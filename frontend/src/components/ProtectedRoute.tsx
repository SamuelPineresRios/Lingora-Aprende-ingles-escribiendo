import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/hooks/useAuth'
import { GuestGate } from '@/components/GuestGate'

/**
 * Guardia de rutas del SPA.
 *
 * Si no hay sesión, crea una cuenta de invitado automáticamente: el visitante
 * entra directo al sistema y puede probar un par de misiones antes de
 * registrarse. El login sigue disponible para quien ya tiene cuenta.
 */
export function ProtectedRoute({
  teacherOnly = false,
  accountOnly = false,
}: {
  teacherOnly?: boolean
  accountOnly?: boolean
}) {
  const { user, loading, startGuest } = useAuth()
  const [guestError, setGuestError] = useState(false)

  useEffect(() => {
    if (loading || user) return

    let active = true
    void startGuest().then(guest => {
      if (active && !guest) setGuestError(true)
    })

    return () => {
      active = false
    }
  }, [loading, user, startGuest])

  if (loading || (!user && !guestError)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center">
        <p className="text-sm text-slate-300">No se pudo iniciar el modo invitado.</p>
        <p className="max-w-sm text-xs text-slate-500">
          Puedes crear una cuenta o iniciar sesión para seguir.
        </p>
        <div className="flex gap-2">
          <Link
            to="/signup"
            className="rounded-xl bg-cyan px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-950"
          >
            Crear cuenta
          </Link>
          <Link
            to="/login"
            className="rounded-xl border border-white/15 px-4 py-2 text-xs uppercase tracking-widest text-slate-300 hover:border-white/30"
          >
            Iniciar sesión
          </Link>
        </div>
        <button
          onClick={() => {
            setGuestError(false)
            void startGuest().then(guest => {
              if (!guest) setGuestError(true)
            })
          }}
          className="text-[10px] uppercase tracking-widest text-slate-500 hover:text-white"
        >
          Reintentar modo invitado
        </button>
      </div>
    )
  }

  if (teacherOnly && user.role !== 'teacher') return <Navigate to="/missions" replace />
  if (accountOnly && user.is_guest) return <GuestGate />

  return <Outlet />
}
