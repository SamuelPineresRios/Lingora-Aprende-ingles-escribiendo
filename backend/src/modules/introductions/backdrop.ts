/**
 * Saneamiento de la dirección de arte del fondo.
 *
 * El modelo puede inventar colores o tipos de escena: aquí se filtra contra
 * las listas permitidas y, si algo no cuadra, se descarta el fondo entero
 * (mejor sin fondo propio que con una geometría inexistente). Cuando no hay
 * `backdrop`, el frontend cae a un fondo por palabras clave.
 */
import {
  BACKDROP_KINDS,
  BACKDROP_LIGHTS,
  BACKDROP_STYLES,
  type BackdropKind,
  type BackdropLight,
  type BackdropStyle,
  type MissionBackdrop,
} from '@vox/shared'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export function sanitizeBackdrop(raw: unknown): MissionBackdrop | null {
  if (!raw || typeof raw !== 'object') return null
  const backdrop = raw as Record<string, unknown>

  const kind = backdrop.kind as BackdropKind
  const style = backdrop.style as BackdropStyle
  const light = backdrop.light as BackdropLight
  if (!BACKDROP_KINDS.includes(kind)) return null
  if (!BACKDROP_STYLES.includes(style)) return null
  if (!BACKDROP_LIGHTS.includes(light)) return null

  const palette = Array.isArray(backdrop.palette)
    ? backdrop.palette.filter(
        (color): color is string => typeof color === 'string' && HEX_COLOR.test(color),
      )
    : []
  // El esquema pide exactamente tres: cielo/base, media distancia y acento.
  if (palette.length !== 3) return null

  const props = Array.isArray(backdrop.props)
    ? backdrop.props
        .filter((prop): prop is string => typeof prop === 'string' && prop.trim().length > 0)
        .map(prop => prop.trim().slice(0, 24))
        .slice(0, 4)
    : []

  return { kind, style, light, palette, ...(props.length > 0 ? { props } : {}) }
}
