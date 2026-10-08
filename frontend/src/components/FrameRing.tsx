/**
 * Marcos animados que se llevan en el avatar (tienda y pase).
 *
 * Cada id tiene su diseño: fuego (aro ígneo girando), esmeralda (hexágono),
 * neón (doble aro), medianoche (estela y satélites), metales del pase (aro
 * pulido), diamante (rombo) y campeón (satélites festivos). El degradado gira
 * en su propia capa para no girar el contenido, el neón late con `--glow-a` y
 * `--glow-b`, y las formas con `clip-path` usan drop-shadow para que el
 * resplandor siga la silueta.
 */
import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type FrameDesign = 'fuego' | 'hexagono' | 'neon' | 'orbita' | 'metal' | 'rombo' | 'corona'

const DESIGN_BY_ID: Record<string, FrameDesign> = {
  'marco-fuego': 'fuego',
  'marco-esmeralda': 'hexagono',
  'marco-neon': 'neon',
  'marco-medianoche': 'orbita',
  bronce: 'metal',
  plata: 'metal',
  oro: 'metal',
  diamante: 'rombo',
  campeon: 'corona',
}

const HEXAGONO = 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)'
const DIAMANTE = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'

/** Punto que brilla girando alrededor del marco. */
function Satelite({ duration, delay = '0s', className }: { duration: string; delay?: string; className?: string }) {
  return (
    <span aria-hidden className="frame-spin absolute inset-0" style={{ animationDuration: duration, animationDelay: delay }}>
      <span className={cn('frame-twinkle absolute left-1/2 top-0 -translate-x-1/2 rounded-full', className)} />
    </span>
  )
}

export function FrameRing({
  frameId,
  colors,
  size = 56,
  className,
  children,
}: {
  frameId: string
  colors: [string, string]
  size?: number
  className?: string
  children?: ReactNode
}) {
  const design = DESIGN_BY_ID[frameId] ?? 'metal'
  const [a, b] = colors
  const band = Math.max(3, Math.round(size * 0.05))
  const glow = { '--glow-a': `${a}cc`, '--glow-b': `${b}59` } as CSSProperties
  const box: CSSProperties = { width: size, height: size }
  const content = <div className="relative flex h-full w-full items-center justify-center">{children}</div>

  // Formas con silueta propia: el hueco es el mismo polígono y el neón sigue el borde.
  if (design === 'hexagono' || design === 'rombo') {
    const clip = design === 'hexagono' ? HEXAGONO : DIAMANTE
    return (
      <div className={cn('relative shrink-0', className)} style={box}>
        <span
          aria-hidden
          className="frame-glow-drop absolute inset-0"
          style={{ ...glow, clipPath: clip, background: `linear-gradient(135deg, ${a}, ${b}, ${a})` }}
        />
        <div className="absolute overflow-hidden bg-slate-950" style={{ inset: '6.5%', clipPath: clip }}>
          {content}
        </div>
      </div>
    )
  }

  const mask = `radial-gradient(farthest-side, transparent calc(100% - ${band}px), #000 calc(100% - ${band - 1}px))`
  const maskStyle: CSSProperties = { maskImage: mask, WebkitMaskImage: mask }

  const rings: Record<string, { background: string; duration: string; extra?: ReactNode }> = {
    fuego: {
      background: `conic-gradient(from 0deg, #7f1d1d, ${a}, ${b}, #fde68a, ${a}, #7f1d1d)`,
      duration: '4.5s',
      extra: (
        <span
          aria-hidden
          className="frame-spin-reverse absolute inset-0 rounded-full"
          style={{
            ...maskStyle,
            background: `conic-gradient(from 180deg, transparent 0 55%, ${b}80 75%, transparent 100%)`,
            animationDuration: '2.2s',
          }}
        />
      ),
    },
    neon: {
      background: `conic-gradient(from 0deg, ${a}, ${b}, #22d3ee, ${b}, ${a})`,
      duration: '3.5s',
      extra: (
        <span
          aria-hidden
          className="frame-spin-reverse absolute rounded-full border border-dashed border-cyan/40"
          style={{ inset: band + 3, animationDuration: '9s' }}
        />
      ),
    },
    orbita: {
      background: 'conic-gradient(from 0deg, transparent 0 70%, rgba(226, 232, 240, 0.95) 88%, transparent 100%)',
      duration: '7s',
      extra: (
        <>
          <span aria-hidden className="absolute inset-0 rounded-full border border-slate-400/30" />
          <Satelite duration="9s" className="h-1.5 w-1.5 bg-slate-200" />
          <Satelite duration="12s" delay="1.4s" className="h-1 w-1 bg-cyan-300/80" />
        </>
      ),
    },
    metal: {
      background: `conic-gradient(from 0deg, ${a}, ${b}, #ffffffd9, ${a}, ${b})`,
      duration: '6s',
    },
    corona: {
      background: `conic-gradient(from 0deg, ${a}, ${b}, #f9a8d4, ${b}, ${a})`,
      duration: '4s',
      extra: (
        <>
          <Satelite duration="7s" className="h-1.5 w-1.5 bg-fuchsia-300" />
          <Satelite duration="10s" delay="1s" className="h-1 w-1 bg-violet-300/90" />
        </>
      ),
    },
  }

  const ring = rings[design] ?? rings.metal

  return (
    <div className={cn('relative shrink-0', className)} style={box}>
      <span aria-hidden className="frame-glow absolute inset-0 rounded-full" style={glow} />
      <span
        aria-hidden
        className="frame-spin absolute inset-0 rounded-full"
        style={{ ...maskStyle, background: ring.background, animationDuration: ring.duration }}
      />
      {ring.extra}
      <div className="absolute overflow-hidden rounded-full bg-slate-950" style={{ inset: band }}>
        {content}
      </div>
    </div>
  )
}
