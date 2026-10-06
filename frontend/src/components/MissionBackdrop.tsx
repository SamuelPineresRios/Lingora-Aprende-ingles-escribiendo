/**
 * Fondo ambientado de una misión, dibujado con capas SVG.
 *
 * No usa imágenes: la «dirección de arte» (tipo de lugar, estilo, luz y
 * paleta) se convierte aquí en un pequeño diorama vectorial. El mismo
 * componente sirve para la escena, el chat y las tarjetas; `seed` varía la
 * composición (edificios, árboles, ventanas encendidas) para que dos misiones
 * del mismo tipo no se vean iguales.
 *
 * Estilos:
 * - `flat`: formas planas y limpias, sin adornos.
 * - `diorama`: capas con volumen y sombra suave, como una maqueta.
 * - `blueprint`: líneas técnicas sobre un fondo oscuro.
 */
import { useId, useMemo, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { BackdropLight, BackdropStyle, MissionBackdrop } from '@vox/shared'
import { hashText } from '@/lib/mission-backdrop'

const W = 400
const H = 225

/* ------------------------------- color ------------------------------- */

type RGB = [number, number, number]

function parseHex(hex: string): RGB {
  const value = hex.replace('#', '')
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

function toHex([r, g, b]: RGB): string {
  const channel = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parseHex(a)
  const [r2, g2, b2] = parseHex(b)
  return toHex([r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t])
}

/** Positivo acerca a blanco; negativo, a negro. */
function shade(color: string, amount: number): string {
  return amount >= 0 ? mix(color, '#ffffff', amount) : mix(color, '#000000', -amount)
}

/* -------------------------------- azar -------------------------------- */

function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ------------------------------ pintura ------------------------------- */

interface PaintProps {
  fill: string
  opacity?: number
  stroke?: string
  strokeWidth?: number
  strokeLinejoin?: 'round'
}
type Painter = (fill: string, opacity?: number) => PaintProps

interface Palette {
  skyTop: string
  skyBottom: string
  celestial: string
  far: string
  mid: string
  midDark: string
  ground: string
  accent: string
  line: string
}

function buildPalette(palette: string[], light: BackdropLight, style: BackdropStyle): Palette {
  const [base, mid, accent] = palette
  const night = light === 'night'
  const sunset = light === 'sunset'

  return {
    skyTop:
      style === 'blueprint'
        ? shade(base, -0.72)
        : night
          ? shade(base, -0.45)
          : sunset
            ? mix(base, '#f97316', 0.25)
            : shade(base, 0.12),
    skyBottom:
      style === 'blueprint'
        ? shade(base, -0.45)
        : night
          ? shade(base, -0.02)
          : sunset
            ? mix(base, '#fde68a', 0.45)
            : mix(base, '#ffffff', 0.3),
    celestial: night ? '#e2e8f0' : sunset ? '#fdba74' : '#fff7cc',
    far: night ? shade(mid, -0.22) : shade(mid, 0.14),
    mid,
    midDark: shade(mid, -0.3),
    ground: shade(mid, -0.5),
    accent,
    line: mix(accent, '#ffffff', 0.15),
  }
}

/* ---------------------------- piezas base ----------------------------- */

interface KindContext {
  c: Palette
  paint: Painter
  /** Como `paint`, pero siempre relleno: luces, ventanas encendidas. */
  lit: Painter
  rng: () => number
  uid: string
  props: string[]
}

function skyline(
  { c, paint, lit, rng }: KindContext,
  { baseline, maxHeight, color, x, width }: { baseline: number; maxHeight: number; color: string; x: number; width: number },
): ReactNode {
  const buildings: ReactNode[] = []
  let cursor = x
  let key = 0

  while (cursor < x + width - 12) {
    const w = 16 + rng() * 24
    const h = maxHeight * (0.3 + rng() * 0.7)
    buildings.push(
      <rect key={`b${key++}`} x={cursor} y={baseline - h} width={w} height={h} {...paint(color)} />,
    )

    const windows: ReactNode[] = []
    for (let wy = baseline - h + 6; wy < baseline - 8; wy += 11) {
      for (let wx = cursor + 4; wx < cursor + w - 5; wx += 8) {
        if (rng() < 0.16) {
          windows.push(<rect key={`w${key++}`} x={wx} y={wy} width={3} height={4} {...lit(c.accent, 0.5)} />)
        }
      }
    }
    if (windows.length > 0) buildings.push(<g key={`g${key++}`}>{windows}</g>)
    cursor += w + 3 + rng() * 7
  }

  return <>{buildings}</>
}

function plant({ c, paint }: KindContext, x: number, y: number, scale = 1): ReactNode {
  const pot = 13 * scale
  const potHeight = 14 * scale
  return (
    <g>
      <path
        d={`M${x - pot / 2} ${y} h${pot} l${-pot * 0.18} ${potHeight} h${-pot * 0.64} Z`}
        {...paint(c.midDark)}
      />
      <ellipse cx={x} cy={y - potHeight * 0.5} rx={8 * scale} ry={10 * scale} {...paint(c.far)} />
      <ellipse cx={x - pot * 0.35} cy={y - potHeight * 0.1} rx={6 * scale} ry={7 * scale} {...paint(c.mid)} />
    </g>
  )
}

function tree(ctx: KindContext, x: number, y: number, scale = 1): ReactNode {
  const { c, paint } = ctx
  const h = 34 * scale
  return (
    <g>
      <rect x={x - 2 * scale} y={y - h * 0.5} width={4 * scale} height={h * 0.5} {...paint(c.midDark)} />
      <circle cx={x} cy={y - h * 0.72} r={h * 0.32} {...paint(c.far)} />
      <circle cx={x - h * 0.2} cy={y - h * 0.5} r={h * 0.24} {...paint(c.mid)} />
      <circle cx={x + h * 0.18} cy={y - h * 0.55} r={h * 0.22} {...paint(c.far)} />
    </g>
  )
}

function lamp(ctx: KindContext, x: number, y: number, scale = 1): ReactNode {
  const { c, paint, lit } = ctx
  const h = 46 * scale
  return (
    <g>
      <rect x={x - 1.5 * scale} y={y - h} width={3 * scale} height={h} {...paint(c.midDark)} />
      <path d={`M${x - 9 * scale} ${y - h} h${18 * scale} l${-9 * scale} ${-8 * scale} Z`} {...paint(c.midDark)} />
      <circle cx={x} cy={y - h + 3 * scale} r={4 * scale} {...lit(c.accent, 0.9)} />
    </g>
  )
}

/* ------------------------------- tipos -------------------------------- */

function officeScene(ctx: KindContext): ReactNode {
  const { c, paint, lit, uid, rng } = ctx
  return (
    <>
      <defs>
        <clipPath id={`win-${uid}`}>
          <rect x="24" y="18" width="352" height="112" rx="4" />
        </clipPath>
      </defs>
      {/* Ventanal con la ciudad */}
      <rect x="24" y="18" width="352" height="112" rx="4" {...paint(c.far, 0.95)} />
      <g clipPath={`url(#win-${uid})`}>
        {skyline(ctx, { baseline: 130, maxHeight: 86, color: c.midDark, x: 26, width: 350 })}
      </g>
      <rect x="24" y="18" width="352" height="112" rx="4" fill="none" stroke={c.line} strokeOpacity="0.3" strokeWidth="2" />
      {/* Escritorio, monitor y silla */}
      <rect x="58" y="170" width="284" height="10" rx="2" {...paint(c.mid)} />
      <rect x="58" y="180" width="284" height="26" {...paint(c.midDark)} />
      <rect x="150" y="118" width="104" height="52" rx="4" {...paint(c.midDark)} />
      <rect x="158" y="126" width="88" height="36" rx="2" {...lit(c.accent, 0.35)} />
      <rect x="196" y="170" width="10" height="8" {...paint(c.midDark)} />
      <rect x="272" y="140" width="64" height="30" rx="8" {...paint(c.midDark)} />
      {rng() > 0.35 && plant(ctx, 46, 132, 0.95)}
    </>
  )
}

function shopScene(ctx: KindContext): ReactNode {
  const { c, paint, lit, rng } = ctx
  const shelves = [64, 98, 132]
  return (
    <>
      <rect x="0" y="0" width="400" height="170" {...paint(c.mid, 0.5)} />
      {shelves.map((y, index) => (
        <g key={y}>
          <rect x="36" y={y} width="164" height="6" rx="2" {...paint(c.midDark)} />
          {Array.from({ length: 7 }, (_, i) => {
            const itemHeight = 12 + rng() * 12
            return (
              <rect
                key={i}
                x={42 + i * 22}
                y={y - itemHeight}
                width={11 + rng() * 5}
                height={itemHeight}
                rx="2"
                {...paint(index === 1 ? c.accent : c.midDark, 0.85)}
              />
            )
          })}
        </g>
      ))}
      <rect x="214" y="128" width="160" height="72" rx="4" {...paint(c.midDark)} />
      <rect x="206" y="122" width="176" height="10" rx="3" {...paint(c.mid)} />
      <rect x="236" y="140" width="46" height="30" rx="3" {...lit(c.accent, 0.28)} />
      {plant(ctx, 356, 128, 0.9)}
    </>
  )
}

function restaurantScene(ctx: KindContext): ReactNode {
  const { c, paint, lit, rng } = ctx
  const lamps = [96, 200, 304]
  return (
    <>
      <rect x="0" y="0" width="400" height="168" {...paint(c.mid, 0.45)} />
      <rect x="30" y="34" width="150" height="86" rx="4" {...paint(c.far, 0.9)} />
      <rect x="30" y="34" width="150" height="86" rx="4" fill="none" stroke={c.line} strokeOpacity="0.25" strokeWidth="2" />
      {lamps.map(x => (
        <g key={x}>
          <rect x={x - 1} y="0" width="2" height="34" {...paint(c.midDark)} />
          <circle cx={x} cy="40" r="8" {...lit(c.accent, 0.85)} />
        </g>
      ))}
      {[86, 262].map(x => (
        <g key={x}>
          <ellipse cx={x} cy="150" rx="46" ry="12" {...paint(c.midDark)} />
          <rect x={x - 4} y="150" width="8" height="34" {...paint(c.midDark)} />
          <rect x={x - 54} y="168" width="26" height="26" rx="6" {...paint(c.far)} />
          <rect x={x + 28} y="168" width="26" height="26" rx="6" {...paint(c.far)} />
        </g>
      ))}
      {rng() > 0.3 && plant(ctx, 372, 156, 0.85)}
    </>
  )
}

function streetScene(ctx: KindContext): ReactNode {
  const { c, paint, lit, rng } = ctx
  return (
    <>
      {skyline(ctx, { baseline: 150, maxHeight: 66, color: c.far, x: 120, width: 170 })}
      {/* Fachadas laterales */}
      {[0, 292].map(x => (
        <g key={x}>
          <rect x={x} y="26" width="108" height="124" {...paint(c.midDark)} />
          {Array.from({ length: 8 }, (_, i) => (
            <rect
              key={i}
              x={x + 14 + (i % 3) * 32}
              y={44 + Math.floor(i / 3) * 32}
              width="16"
              height="20"
              rx="2"
              {...(rng() < 0.3 ? lit(c.accent, 0.5) : paint(c.mid, 0.8))}
            />
          ))}
        </g>
      ))}
      {/* Calzada */}
      <path d={`M0 ${H} L110 150 H290 L${W} ${H} Z`} {...paint(c.ground)} />
      <path d={`M186 152 L214 152 L232 ${H} L168 ${H} Z`} {...paint(c.mid, 0.5)} />
      <rect x="196" y="158" width="8" height="16" {...lit(c.accent, 0.35)} />
      <rect x="193" y="196" width="14" height="20" {...lit(c.accent, 0.3)} />
      {lamp(ctx, 120, 152, 1.35)}
    </>
  )
}

function transportScene(ctx: KindContext): ReactNode {
  const { c, paint, lit } = ctx
  return (
    <>
      {/* Marquesina */}
      <path d="M0 44 L400 26 L400 34 L0 52 Z" {...paint(c.midDark)} />
      <rect x="60" y="48" width="5" height="104" {...paint(c.midDark)} />
      <rect x="335" y="44" width="5" height="108" {...paint(c.midDark)} />
      {/* Andén */}
      <rect x="0" y="152" width="400" height="73" {...paint(c.ground)} />
      <rect x="0" y="152" width="400" height="5" {...lit(c.accent, 0.25)} />
      {/* Vagón */}
      <rect x="118" y="82" width="248" height="72" rx="10" {...paint(c.midDark)} />
      <rect x="132" y="96" width="220" height="26" rx="4" {...lit(c.accent, 0.28)} />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} x={140 + i * 31} y="98" width="22" height="22" rx="3" {...paint(c.mid, 0.9)} />
      ))}
      <circle cx="140" cy="160" r="9" {...paint(c.mid)} />
      <circle cx="344" cy="160" r="9" {...paint(c.mid)} />
      <circle cx="356" cy="118" r="4" {...lit(c.accent, 0.95)} />
    </>
  )
}

function campusScene(ctx: KindContext): ReactNode {
  const { c, paint, rng } = ctx
  return (
    <>
      <ellipse cx="200" cy="176" rx="240" ry="52" {...paint(c.far, 0.6)} />
      {/* Edificio con columnas */}
      <rect x="120" y="86" width="160" height="76" {...paint(c.midDark)} />
      <path d="M112 86 L200 48 L288 86 Z" {...paint(c.mid)} />
      <rect x="112" y="82" width="176" height="8" {...paint(c.mid)} />
      {[136, 164, 192, 220, 248].map(x => (
        <rect key={x} x={x} y="92" width="14" height="62" rx="3" {...paint(c.mid)} />
      ))}
      <rect x="120" y="162" width="160" height="10" {...paint(c.mid)} />
      <rect x="188" y="128" width="24" height="44" rx="3" {...paint(c.midDark)} />
      {/* Césped, camino y árboles */}
      <path d={`M120 172 Q200 150 280 172 L340 225 L60 225 Z`} {...paint(c.ground)} />
      <path d={`M180 225 Q200 190 200 172 L220 172 Q216 192 236 225 Z`} {...paint(c.far, 0.5)} />
      {tree(ctx, 52, 176, 1 + rng() * 0.3)}
      {tree(ctx, 348, 180, 0.9 + rng() * 0.3)}
      {rng() > 0.45 && tree(ctx, 88, 186, 0.75)}
    </>
  )
}

function homeScene(ctx: KindContext): ReactNode {
  const { c, paint, lit } = ctx
  return (
    <>
      {/* Ventana con cortinas */}
      <rect x="40" y="30" width="140" height="92" rx="4" {...paint(c.far, 0.85)} />
      <rect x="40" y="30" width="140" height="92" rx="4" fill="none" stroke={c.line} strokeOpacity="0.25" strokeWidth="2" />
      <path d="M36 26 h34 l-10 96 h-30 Z" {...paint(c.mid)} />
      <path d="M150 26 h34 l6 96 h-30 Z" {...paint(c.mid)} />
      {/* Sofá, mesa y lámpara */}
      <rect x="208" y="126" width="160" height="52" rx="12" {...paint(c.mid)} />
      <rect x="216" y="134" width="66" height="34" rx="8" {...paint(c.midDark)} />
      <rect x="290" y="134" width="66" height="34" rx="8" {...paint(c.midDark)} />
      <rect x="208" y="176" width="160" height="24" rx="6" {...paint(c.midDark)} />
      <ellipse cx="200" cy="206" rx="120" ry="16" {...paint(c.ground, 0.85)} />
      <rect x="96" y="168" width="10" height="42" {...paint(c.midDark)} />
      <ellipse cx="101" cy="164" rx="16" ry="8" {...paint(c.mid)} />
      <circle cx="101" cy="160" r="5" {...lit(c.accent, 0.85)} />
      {plant(ctx, 44, 170, 0.9)}
    </>
  )
}

function gymScene(ctx: KindContext): ReactNode {
  const { c, paint, lit } = ctx
  return (
    <>
      {/* Espejo */}
      <rect x="24" y="26" width="352" height="82" rx="4" {...paint(c.far, 0.55)} />
      <path d="M60 108 L150 26 L196 26 L106 108 Z" {...paint(c.mid, 0.18)} />
      <rect x="24" y="26" width="352" height="82" rx="4" fill="none" stroke={c.line} strokeOpacity="0.2" strokeWidth="2" />
      {/* Rack con barra */}
      <rect x="118" y="118" width="8" height="70" rx="2" {...paint(c.midDark)} />
      <rect x="274" y="118" width="8" height="70" rx="2" {...paint(c.midDark)} />
      <rect x="108" y="128" width="184" height="6" rx="3" {...paint(c.mid)} />
      {[124, 132, 276, 284].map(x => (
        <rect key={x} x={x} y="118" width="10" height="28" rx="4" {...lit(c.accent, 0.8)} />
      ))}
      {/* Banco y mancuernas */}
      <rect x="150" y="176" width="100" height="10" rx="4" {...paint(c.midDark)} />
      <rect x="158" y="186" width="8" height="26" {...paint(c.midDark)} />
      <rect x="234" y="186" width="8" height="26" {...paint(c.midDark)} />
      <rect x="300" y="196" width="34" height="10" rx="4" {...paint(c.mid)} />
      <rect x="60" y="196" width="34" height="10" rx="4" {...paint(c.mid)} />
    </>
  )
}

function parkScene(ctx: KindContext): ReactNode {
  const { c, paint, rng } = ctx
  return (
    <>
      <ellipse cx="110" cy="164" rx="220" ry="54" {...paint(c.far, 0.7)} />
      <ellipse cx="330" cy="176" rx="200" ry="48" {...paint(c.far, 0.5)} />
      <path d={`M0 176 Q120 150 220 176 T400 168 L400 225 L0 225 Z`} {...paint(c.ground)} />
      <path d={`M60 225 Q140 186 210 178 L228 178 Q170 196 150 225 Z`} {...paint(c.far, 0.45)} />
      {tree(ctx, 76, 182, 1.2 + rng() * 0.2)}
      {tree(ctx, 330, 186, 1 + rng() * 0.25)}
      {rng() > 0.4 && tree(ctx, 150, 190, 0.85)}
      {rng() > 0.5 && tree(ctx, 260, 194, 0.75)}
      {/* Banco */}
      <rect x="250" y="196" width="66" height="7" rx="2" {...paint(c.midDark)} />
      <rect x="250" y="186" width="66" height="6" rx="2" {...paint(c.midDark)} />
      <rect x="256" y="203" width="6" height="16" {...paint(c.midDark)} />
      <rect x="304" y="203" width="6" height="16" {...paint(c.midDark)} />
    </>
  )
}

function hotelScene(ctx: KindContext): ReactNode {
  const { c, paint, lit } = ctx
  return (
    <>
      {/* Arco y columnas */}
      <path d="M100 72 Q200 20 300 72 L300 168 L100 168 Z" {...paint(c.mid, 0.4)} />
      <rect x="96" y="70" width="14" height="98" rx="4" {...paint(c.midDark)} />
      <rect x="290" y="70" width="14" height="98" rx="4" {...paint(c.midDark)} />
      {[140, 260].map(x => (
        <circle key={`l${x}`} cx={x} cy="52" r="7" {...lit(c.accent, 0.85)} />
      ))}
      <rect x={122} y="42" width="2" height="14" {...paint(c.midDark)} />
      <rect x={278} y="42" width="2" height="14" {...paint(c.midDark)} />
      {/* Recepción, campana y equipaje */}
      <rect x="120" y="140" width="176" height="48" rx="4" {...paint(c.midDark)} />
      <rect x="112" y="132" width="192" height="10" rx="4" {...paint(c.mid)} />
      <path d="M198 124 a12 10 0 0 1 24 0 Z" {...lit(c.accent, 0.9)} />
      <rect x="60" y="158" width="40" height="30" rx="6" {...paint(c.midDark)} />
      <rect x="66" y="150" width="28" height="10" rx="4" {...paint(c.mid)} />
      <rect x="310" y="158" width="44" height="30" rx="6" {...paint(c.midDark)} />
      <rect x="318" y="166" width="28" height="4" rx="2" {...lit(c.accent, 0.5)} />
    </>
  )
}

function healthScene(ctx: KindContext): ReactNode {
  const { c, paint, lit } = ctx
  return (
    <>
      <rect x="0" y="0" width="400" height="170" {...paint(c.mid, 0.4)} />
      {/* Cruz de farmacia */}
      <rect x="308" y="44" width="56" height="56" rx="8" {...lit(c.accent, 0.22)} />
      <rect x="330" y="54" width="12" height="36" rx="3" {...lit(c.accent, 0.9)} />
      <rect x="318" y="66" width="36" height="12" rx="3" {...lit(c.accent, 0.9)} />
      {/* Estantes con frascos */}
      {[74, 108].map((y, row) => (
        <g key={y}>
          <rect x="36" y={y} width="180" height="6" rx="2" {...paint(c.midDark)} />
          {Array.from({ length: 6 }, (_, i) => (
            <rect
              key={i}
              x={44 + i * 28}
              y={y - 18 - (i % 3) * 2}
              width={14}
              height={18 + (i % 3) * 2}
              rx="3"
              {...paint(row === 0 ? c.accent : c.midDark, 0.8)}
            />
          ))}
        </g>
      ))}
      <rect x="30" y="150" width="200" height="60" rx="4" {...paint(c.midDark)} />
      <rect x="24" y="144" width="212" height="10" rx="4" {...paint(c.mid)} />
    </>
  )
}

function servicesScene(ctx: KindContext): ReactNode {
  const { c, paint, lit } = ctx
  return (
    <>
      <rect x="0" y="0" width="400" height="168" {...paint(c.mid, 0.35)} />
      {/* Pantalla de turnos */}
      <rect x="236" y="34" width="132" height="54" rx="4" {...paint(c.midDark)} />
      <rect x="246" y="44" width="60" height="8" rx="3" {...lit(c.accent, 0.7)} />
      <rect x="246" y="60" width="94" height="6" rx="3" {...lit(c.accent, 0.3)} />
      {/* Mostrador y terminal */}
      <rect x="40" y="130" width="320" height="70" rx="4" {...paint(c.midDark)} />
      <rect x="32" y="122" width="336" height="10" rx="4" {...paint(c.mid)} />
      <rect x="84" y="96" width="54" height="30" rx="3" {...paint(c.midDark)} />
      <rect x="90" y="102" width="42" height="18" rx="2" {...lit(c.accent, 0.35)} />
      {/* Postes de fila */}
      <rect x="296" y="96" width="4" height="30" {...paint(c.mid)} />
      <circle cx="298" cy="94" r="4" {...lit(c.accent, 0.8)} />
      <rect x="360" y="96" width="4" height="30" {...paint(c.mid)} />
      <circle cx="362" cy="94" r="4" {...lit(c.accent, 0.8)} />
      <rect x="298" y="108" width="64" height="3" {...paint(c.mid, 0.7)} />
    </>
  )
}

function genericScene(ctx: KindContext): ReactNode {
  const { c, paint, rng } = ctx
  return (
    <>
      {skyline(ctx, { baseline: 168, maxHeight: 96, color: c.far, x: 8, width: 384 })}
      <rect x="0" y="168" width="400" height="57" {...paint(c.ground)} />
      <path d={`M0 168 Q200 150 400 168 L400 190 L0 190 Z`} {...paint(c.mid, 0.5)} />
      {tree(ctx, 74, 176, 0.9 + rng() * 0.3)}
      {tree(ctx, 322, 178, 0.85 + rng() * 0.3)}
    </>
  )
}

const KINDS: Record<MissionBackdrop['kind'], (ctx: KindContext) => ReactNode> = {
  office: officeScene,
  shop: shopScene,
  restaurant: restaurantScene,
  street: streetScene,
  transport: transportScene,
  campus: campusScene,
  home: homeScene,
  gym: gymScene,
  park: parkScene,
  hotel: hotelScene,
  health: healthScene,
  services: servicesScene,
  generic: genericScene,
}

/* ----------------------------- componente ----------------------------- */

interface MissionBackdropProps {
  backdrop: MissionBackdrop
  /** `card`: tarjeta pequeña; `scene`: pantalla completa. */
  variant?: 'scene' | 'card'
  /** Varía la composición (p. ej. el id de la misión). */
  seed?: string
  className?: string
}

export function MissionBackdrop({ backdrop, variant = 'scene', seed, className }: MissionBackdropProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const { kind, style, light, palette } = backdrop

  const c = useMemo(() => buildPalette(palette, light, style), [palette, light, style])
  const rng = useMemo(
    () => mulberry32(hashText(seed ?? `${kind}-${palette[1]}-${light}`)),
    [seed, kind, palette, light],
  )

  const paint: Painter = (fill, opacity = 1) =>
    style === 'blueprint'
      ? { fill: 'none', stroke: c.line, strokeWidth: 1.1, strokeLinejoin: 'round', opacity }
      : { fill, opacity }
  const lit: Painter = (fill, opacity = 1) => ({ fill, opacity })
  const ctx: KindContext = { c, paint, lit, rng, uid, props: backdrop.props ?? [] }

  const stars = light === 'night' && style !== 'blueprint' ? (
    <g>
      {Array.from({ length: 16 }, (_, i) => (
        <circle
          key={i}
          cx={8 + rng() * 384}
          cy={6 + rng() * 118}
          r={0.6 + rng() * 1.1}
          fill="#e2e8f0"
          opacity={0.25 + rng() * 0.5}
        />
      ))}
    </g>
  ) : null

  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <defs>
          <linearGradient id={`sky${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.skyTop} />
            <stop offset="100%" stopColor={c.skyBottom} />
          </linearGradient>
          <radialGradient id={`sun${uid}`}>
            <stop offset="0%" stopColor={c.celestial} stopOpacity="0.95" />
            <stop offset="100%" stopColor={c.celestial} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`vig${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="52%" stopColor="#020617" stopOpacity="0" />
            <stop offset="100%" stopColor="#020617" stopOpacity={variant === 'card' ? 0.5 : 0.72} />
          </linearGradient>
        </defs>

        <rect width={W} height={H} fill={`url(#sky${uid})`} />

        {style === 'blueprint' && (
          <g opacity="0.09">
            {Array.from({ length: 9 }, (_, i) => (
              <line key={`v${i}`} x1={(i + 1) * 40} y1="0" x2={(i + 1) * 40} y2={H} stroke={c.accent} strokeWidth="1" />
            ))}
            {Array.from({ length: 5 }, (_, i) => (
              <line key={`h${i}`} x1="0" y1={(i + 1) * 38} x2={W} y2={(i + 1) * 38} stroke={c.accent} strokeWidth="1" />
            ))}
          </g>
        )}

        {style !== 'blueprint' && (
          <circle
            cx={280 + rng() * 70}
            cy={light === 'sunset' ? 132 : 44}
            r={light === 'day' ? 30 : 18}
            fill={`url(#sun${uid})`}
          />
        )}
        {stars}

        {KINDS[kind](ctx)}

        <rect width={W} height={H} fill={`url(#vig${uid})`} />
      </svg>
    </div>
  )
}
