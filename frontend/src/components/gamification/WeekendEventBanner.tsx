/**
 * Banner del evento de fin de semana.
 *
 * Activo (sábado o domingo): escena especial del nivel, doble XP y marco
 * exclusivo al completarla. En semana: cuenta atrás al próximo sábado.
 * El estado lo calcula el backend con la zona horaria del alumno.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Gift, Sparkles } from 'lucide-react'
import { readJson } from '@/lib/api'
import { useAuth } from '@/lib/hooks/useAuth'

interface WeekendEvent {
  active: boolean
  starts_at: string
  ends_at: string
  xp_percent: number
  mission: { id: string; title: string } | null
  frame: { id: string; label: string; owned: boolean }
}

/** «sábado 17» a partir de una clave YYYY-MM-DD. */
function formatDay(key: string): string {
  return new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric' }).format(new Date(`${key}T12:00:00Z`))
}

export function WeekendEventBanner() {
  const { user } = useAuth()
  const [event, setEvent] = useState<WeekendEvent | null>(null)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)

    fetch(`/api/students/${user.id}/event?tz=${tz}`)
      .then(readJson<WeekendEvent>)
      .then(data => {
        if (!cancelled && data) setEvent(data)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [user?.id])

  if (!event?.mission) return null

  if (!event.active) {
    return (
      <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/25 px-4 py-3">
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-500" />
        <p className="text-[11px] uppercase tracking-widest text-slate-500">
          Evento de fin de semana: el {formatDay(event.starts_at)} llega «{event.mission.title}» con doble XP y marco
          exclusivo.
        </p>
      </div>
    )
  }

  return (
    <div className="mb-6 space-y-3 rounded-2xl border border-amber/50 bg-gradient-to-r from-amber/15 via-coral/10 to-amber/5 px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full border border-amber/50 bg-amber/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber">
          <Sparkles className="h-3 w-3" /> Evento de fin de semana
        </span>
        <span className="text-[10px] uppercase tracking-widest text-slate-400">
          Solo hasta el {formatDay(event.ends_at)}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-body text-lg font-semibold text-white">{event.mission.title}</p>
          <p className="mt-1 text-[11px] uppercase tracking-widest text-slate-400">
            +{event.xp_percent - 100}% de XP
            {event.frame.owned ? ' · marco conseguido' : ` · gana el ${event.frame.label}`}
          </p>
        </div>
        <Link
          to={`/mission/${event.mission.id}`}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-amber px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-black transition-colors hover:bg-amber-light"
        >
          <Gift className="h-4 w-4" /> Jugar el evento
        </Link>
      </div>
    </div>
  )
}
