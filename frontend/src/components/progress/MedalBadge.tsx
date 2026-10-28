/**
 * Insignia de medalla: el icono va dentro de una medalla de verdad.
 *
 * Ganada: aro metálico dorado (conic-gradient), brillo que gira, icono en
 * ámbar con resplandor y un halo alrededor para que destaque. Bloqueada: aro
 * gris apagado y un candado abajo a la derecha, para leerse como «aún no».
 */
import { createElement } from 'react'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { medalIcon, type StudentMedal } from '@/lib/medals'

export function MedalBadge({
  medal,
  size = 76,
}: {
  /** Basta el icono y si está ganada (el ranking usa versiones mini). */
  medal: Pick<StudentMedal, 'icon'> & { earned?: boolean }
  size?: number
}) {
  const ring = Math.max(2, Math.round(size * 0.045))
  const inset = Math.max(4, Math.round(size * 0.1))
  const lock = Math.max(13, Math.round(size * 0.3))

  return (
    <div
      className="relative"
      style={{
        width: size,
        height: size,
        filter: medal.earned ? 'drop-shadow(0 0 7px rgba(245,158,11,0.55))' : undefined,
      }}
    >
      {/* Aro de la medalla */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-0 rounded-full',
          medal.earned
            ? 'bg-[conic-gradient(from_0deg,#92400e,#f59e0b,#fde68a,#f59e0b,#92400e)]'
            : 'bg-white/15',
        )}
        style={{ padding: ring }}
      >
        <span className={cn('block h-full w-full rounded-full', medal.earned ? 'bg-slate-950' : 'bg-slate-900')} />
      </span>

      {/* Brillo que recorre el aro */}
      {medal.earned && (
        <span
          aria-hidden
          className="frame-spin absolute inset-0 rounded-full"
          style={{
            animationDuration: '8s',
            background: 'conic-gradient(from 0deg, transparent 0 300deg, rgba(255,255,255,0.5) 330deg, transparent 360deg)',
            maskImage: `radial-gradient(farthest-side, transparent calc(100% - ${ring + 1}px), #000 calc(100% - ${ring}px))`,
            WebkitMaskImage: `radial-gradient(farthest-side, transparent calc(100% - ${ring + 1}px), #000 calc(100% - ${ring}px))`,
          }}
        />
      )}

      {/* Icono (createElement: el compilador no admite componentes en render) */}
      <span className="absolute flex items-center justify-center rounded-full" style={{ inset }}>
        {createElement(medalIcon(medal.icon), {
          className: cn(
            'h-1/2 w-1/2',
            medal.earned ? 'text-amber drop-shadow-[0_0_9px_rgba(245,158,11,0.85)]' : 'text-slate-500',
          ),
        })}
      </span>

      {/* Candado de las pendientes */}
      {!medal.earned && (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border border-white/15 bg-slate-950"
          style={{ width: lock, height: lock }}
        >
          <Lock style={{ width: Math.round(lock * 0.6), height: Math.round(lock * 0.6) }} className="text-slate-500" />
        </span>
      )}
    </div>
  )
}
