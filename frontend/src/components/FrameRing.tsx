/**
 * Marcos animados que se llevan en el avatar (tienda, pase, perfil y ranking).
 *
 * Los diseños son datos: cada id declara su silueta (círculo, hexágono o
 * rombo), su banda, capas superpuestas (escamas, facetas, iridiscencia),
 * anillos, satélites y giro. Añadir un marco es añadir una entrada.
 *
 * El degradado gira en su propia capa para no girar el contenido; el neón late
 * con `--glow-a` y `--glow-b`, y las formas con `clip-path` usan drop-shadow
 * para que el resplandor siga la silueta.
 */
import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Colors = [string, string]
type Shape = 'hexagono' | 'rombo'

/** Capa que solo se pinta sobre la banda (misma máscara que el aro). */
interface Layer {
  background: (colors: Colors) => string
  /** Segundos por vuelta; negativo gira al revés. */
  spin?: number
  opacity?: number
}

interface Ring {
  /** Píxeles extra sobre el ancho de la banda. */
  inset: number
  className: string
  spin?: number
}

interface Spark {
  /** Segundos por vuelta. */
  duration: number
  delay?: string
  /** Clases de tamaño y color del punto. */
  dot: string
}

interface Design {
  shape?: Shape
  band: (colors: Colors) => string
  /** Segundos por vuelta; negativo gira al revés. */
  spin?: number
  /** Banda más fina, para los diseños limpios. */
  tight?: boolean
  overlay?: Layer
  rings?: Ring[]
  sparks?: Spark[]
}

const HEXAGONO = 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)'
const DIAMANTE = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'

/** Aro pulido de los metales del pase, con un reflejo blanco girando. */
const metal = ([a, b]: Colors) => `conic-gradient(from 0deg, ${a}, ${b}, #ffffffd9, ${a}, ${b})`

/** Banda de facetas: segmentos alternos que se leen como una piedra tallada. */
const facetas = (base: string, light: string) =>
  `repeating-conic-gradient(from 0deg, ${light}cc 0deg 11deg, ${base}00 11deg 22deg)`

const DESIGNS: Record<string, Design> = {
  // Tienda
  'marco-fuego': {
    band: ([a, b]) => `conic-gradient(from 0deg, #7f1d1d, ${a}, ${b}, #fde68a, ${a}, #7f1d1d)`,
    spin: 4.5,
    overlay: {
      background: ([, b]) => `conic-gradient(from 180deg, transparent 0 55%, ${b}80 75%, transparent 100%)`,
      spin: -2.2,
    },
  },
  'marco-esmeralda': {
    shape: 'hexagono',
    band: ([a, b]) => `linear-gradient(135deg, ${a}, ${b}, ${a})`,
  },
  'marco-neon': {
    band: ([a, b]) => `conic-gradient(from 0deg, ${a}, ${b}, #22d3ee, ${b}, ${a})`,
    spin: 3.5,
    rings: [{ inset: 3, className: 'border border-dashed border-cyan/40', spin: -9 }],
  },
  'marco-medianoche': {
    band: () => 'conic-gradient(from 0deg, transparent 0 70%, rgba(226, 232, 240, 0.95) 88%, transparent 100%)',
    spin: 7,
    rings: [{ inset: 0, className: 'border border-slate-400/30' }],
    sparks: [
      { duration: 9, dot: 'h-1.5 w-1.5 bg-slate-200' },
      { duration: 12, delay: '1.4s', dot: 'h-1 w-1 bg-cyan-300/80' },
    ],
  },
  // Metales del pase
  bronce: { band: metal, spin: 6 },
  plata: { band: metal, spin: 6 },
  oro: { band: metal, spin: 6 },
  diamante: {
    shape: 'rombo',
    band: ([a, b]) => `linear-gradient(135deg, ${a}, ${b}, ${a})`,
  },
  campeon: {
    band: ([a, b]) => `conic-gradient(from 0deg, ${a}, ${b}, #f9a8d4, ${b}, ${a})`,
    spin: 4,
    sparks: [
      { duration: 7, dot: 'h-1.5 w-1.5 bg-fuchsia-300' },
      { duration: 10, delay: '1s', dot: 'h-1 w-1 bg-violet-300/90' },
    ],
  },
  // Colección de dragones
  'marco-dragon-carmesi': {
    band: ([a, b]) => `conic-gradient(from 0deg, #450a0a, ${a}, #7f1d1d, ${b}, #450a0a)`,
    spin: 9,
    overlay: {
      background: ([a, b]) => `repeating-conic-gradient(from 0deg, ${a} 0deg 9deg, ${b}00 9deg 18deg)`,
      spin: -14,
      opacity: 0.85,
    },
    sparks: [{ duration: 7, dot: 'h-1 w-1 bg-amber-400/90' }],
  },
  'marco-dragon-jade': {
    band: ([a, b]) => `conic-gradient(from 0deg, #052e16, ${a}, #065f46, ${b}, #052e16)`,
    spin: 10,
    overlay: {
      background: ([a, b]) => `repeating-conic-gradient(from 0deg, ${a} 0deg 8deg, ${b}00 8deg 16deg)`,
      spin: -16,
      opacity: 0.85,
    },
    sparks: [{ duration: 8, delay: '0.8s', dot: 'h-1 w-1 bg-emerald-300/90' }],
  },
  'marco-aliento-dragon': {
    band: ([a, b]) => `conic-gradient(from 0deg, transparent 0 38%, ${a}cc 62%, ${b} 72%, transparent 84%)`,
    spin: 3,
    sparks: [
      { duration: 5, dot: 'h-1.5 w-1.5 bg-amber-300' },
      { duration: 7, delay: '0.6s', dot: 'h-1 w-1 bg-orange-400/90' },
      { duration: 9, delay: '1.2s', dot: 'h-1 w-1 bg-red-400/80' },
    ],
  },
  // Piedras
  'marco-zafiro': {
    band: ([a, b]) => `conic-gradient(from 0deg, #0c1a3a, ${a}, #1d4ed8, ${b}, #0c1a3a)`,
    spin: 14,
    tight: true,
    overlay: { background: ([a, b]) => facetas(a, b), spin: -7, opacity: 0.9 },
  },
  'marco-rubi': {
    band: ([a, b]) => `conic-gradient(from 0deg, #3b0a0a, ${a}, #b91c1c, ${b}, #3b0a0a)`,
    spin: 14,
    tight: true,
    overlay: { background: ([a, b]) => facetas(a, b), spin: -7, opacity: 0.9 },
  },
  'marco-amatista': {
    band: ([a, b]) => `conic-gradient(from 0deg, #2e1065, ${a}, #6d28d9, ${b}, #2e1065)`,
    spin: 13,
    tight: true,
    overlay: { background: ([a, b]) => facetas(a, b), spin: -6, opacity: 0.9 },
  },
  'marco-opalo': {
    band: () => 'conic-gradient(from 0deg, #a5f3fc, #f5d0fe, #fef3c7, #bbf7d0, #c7d2fe, #a5f3fc)',
    spin: 18,
    tight: true,
    overlay: {
      background: () =>
        'linear-gradient(120deg, rgba(255, 255, 255, 0.45), transparent 45%, rgba(255, 255, 255, 0.25))',
      spin: 9,
      opacity: 0.6,
    },
  },
  'marco-cuarzo-rosa': {
    band: ([a, b]) => `conic-gradient(from 0deg, ${a}, ${b}, #fff1f2, ${a})`,
    spin: 11,
    tight: true,
    sparks: [{ duration: 12, dot: 'h-1 w-1 bg-pink-200' }],
  },
  'marco-obsidiana': {
    band: () => 'conic-gradient(from 0deg, #05070d, #111827, #1f2937, #05070d)',
    spin: 8,
    tight: true,
    rings: [{ inset: 2, className: 'border border-red-900/80' }],
  },
  'marco-prisma': {
    band: () =>
      'conic-gradient(from 0deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #6366f1, #a855f7, #ef4444)',
    spin: 5,
    tight: true,
  },
  'marco-dragon-dorado': {
    band: ([a, b]) => `conic-gradient(from 0deg, #451a03, ${a}, #78350f, ${b}, #451a03)`,
    spin: 9,
    overlay: {
      background: ([a, b]) => `repeating-conic-gradient(from 0deg, ${b} 0deg 9deg, ${a}00 9deg 18deg)`,
      spin: -14,
      opacity: 0.85,
    },
    sparks: [{ duration: 7, delay: '0.4s', dot: 'h-1 w-1 bg-yellow-200/90' }],
  },
  'marco-perla': {
    band: () => 'conic-gradient(from 0deg, #f8fafc, #fbcfe8, #bae6fd, #f8fafc)',
    spin: 16,
    tight: true,
    overlay: {
      background: () =>
        'linear-gradient(120deg, rgba(255, 255, 255, 0.55), transparent 50%, rgba(255, 255, 255, 0.3))',
      spin: 8,
      opacity: 0.5,
    },
    sparks: [{ duration: 11, dot: 'h-1 w-1 bg-pink-100' }],
  },
  'marco-topacio': {
    band: ([a, b]) => `conic-gradient(from 0deg, #451a03, ${a}, #b45309, ${b}, #451a03)`,
    spin: 13,
    tight: true,
    overlay: { background: ([a, b]) => facetas(a, b), spin: -6, opacity: 0.9 },
  },
  'marco-aurora': {
    band: () => 'conic-gradient(from 0deg, #052e16, #34d399, #0ea5e9, #a78bfa, #052e16)',
    spin: 15,
    overlay: {
      background: () =>
        'linear-gradient(100deg, transparent 10%, rgba(167, 139, 250, 0.55) 45%, transparent 80%)',
      spin: -8,
      opacity: 0.7,
    },
  },
  'marco-eclipse': {
    band: () =>
      'conic-gradient(from 0deg, #05070d 0 62%, #f97316 74%, #fde68a 80%, #f97316 86%, #05070d 100%)',
    spin: 6,
    tight: true,
    rings: [{ inset: 0, className: 'border border-orange-500/20' }],
  },
  'marco-estelar': {
    band: () => 'conic-gradient(from 0deg, #1e1b4b, #312e81, #1e1b4b)',
    spin: 12,
    tight: true,
    overlay: {
      background: () => 'repeating-conic-gradient(from 0deg, rgba(255, 255, 255, 0.95) 0deg 0.8deg, transparent 0.8deg 18deg)',
      spin: -3,
      opacity: 0.8,
    },
    sparks: [
      { duration: 9, dot: 'h-1 w-1 bg-indigo-200' },
      { duration: 13, delay: '1.2s', dot: 'h-0.5 w-0.5 bg-white/90' },
    ],
  },
}

/** Diseño para ids desconocidos: aro pulido con los colores que lleguen. */
const FALLBACK: Design = { band: metal, spin: 6 }

/** Punto que brilla girando alrededor del marco. */
function Satelite({ duration, delay = '0s', className }: { duration: number; delay?: string; className: string }) {
  return (
    <span aria-hidden className="frame-spin absolute inset-0" style={{ animationDuration: `${duration}s`, animationDelay: delay }}>
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
  colors: Colors
  size?: number
  className?: string
  children?: ReactNode
}) {
  const design = DESIGNS[frameId] ?? FALLBACK
  const [a, b] = colors
  const baseBand = Math.max(3, Math.round(size * 0.05))
  const band = design.tight ? Math.max(2, Math.round(baseBand * 0.62)) : baseBand
  const glow = { '--glow-a': `${a}cc`, '--glow-b': `${b}59` } as CSSProperties
  const box: CSSProperties = { width: size, height: size }
  const content = <div className="relative flex h-full w-full items-center justify-center">{children}</div>

  // Siluetas propias: el hueco repite el polígono y el neón sigue el borde.
  if (design.shape) {
    const clip = design.shape === 'hexagono' ? HEXAGONO : DIAMANTE
    return (
      <div className={cn('relative shrink-0', className)} style={box}>
        <span
          aria-hidden
          className="frame-glow-drop absolute inset-0"
          style={{ ...glow, clipPath: clip, background: design.band(colors) }}
        />
        <div className="absolute overflow-hidden bg-slate-950" style={{ inset: '6.5%', clipPath: clip }}>
          {content}
        </div>
      </div>
    )
  }

  const mask = `radial-gradient(farthest-side, transparent calc(100% - ${band}px), #000 calc(100% - ${band - 1}px))`
  const maskStyle: CSSProperties = { maskImage: mask, WebkitMaskImage: mask }
  const spinStyle = (seconds: number): CSSProperties => ({
    animationDuration: `${Math.abs(seconds)}s`,
    animationDirection: seconds < 0 ? 'reverse' : undefined,
  })

  return (
    <div className={cn('relative shrink-0', className)} style={box}>
      <span aria-hidden className="frame-glow absolute inset-0 rounded-full" style={glow} />

      <span
        aria-hidden
        className="frame-spin absolute inset-0 rounded-full"
        style={{ ...maskStyle, background: design.band(colors), ...spinStyle(design.spin ?? 6) }}
      />

      {design.overlay && (
        <span
          aria-hidden
          className="frame-spin absolute inset-0 rounded-full"
          style={{
            ...maskStyle,
            background: design.overlay.background(colors),
            opacity: design.overlay.opacity,
            ...spinStyle(design.overlay.spin ?? 6),
          }}
        />
      )}

      {design.rings?.map((ring, index) => (
        <span
          key={index}
          aria-hidden
          className={cn('absolute rounded-full', ring.spin ? 'frame-spin' : undefined, ring.className)}
          style={{ inset: band + ring.inset, ...(ring.spin ? spinStyle(ring.spin) : {}) }}
        />
      ))}

      {design.sparks?.map((spark, index) => (
        <Satelite key={index} duration={spark.duration} delay={spark.delay} className={spark.dot} />
      ))}

      <div className="absolute overflow-hidden rounded-full bg-slate-950" style={{ inset: band }}>
        {content}
      </div>
    </div>
  )
}
