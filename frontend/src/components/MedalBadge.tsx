/**
 * Insignia de medalla: el icono va dentro de una medalla de verdad.
 *
 * Ganada: cinta coral arriba, aro metálico dorado (conic-gradient), brillo que
 * gira y el icono en ámbar con resplandor. Bloqueada: aro gris apagado y un
 * candado abajo a la derecha, para leerse como «aún no».
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
    <div className="relative" style={{ width: size, height: size }}>
      {/* Cinta en V detrás del aro */}
      <span
        aria-hidden
        className={cn(
          'absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[62%]',
          medal.earned ? 'bg-gradient-to-b from-coral to-rose-800' : 'bg-white/10',
        )}
        style={{ width: size * 0.42, height: size * 0.4, clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }}
      />

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
