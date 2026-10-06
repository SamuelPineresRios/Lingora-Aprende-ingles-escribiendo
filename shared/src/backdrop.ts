/**
 * Fondo ambientado de una misión (contrato backend/frontend).
 *
 * No es una imagen: es una pequeña «dirección de arte» que el frontend pinta
 * con capas SVG (cielo, siluetas, mobiliario y un acento). Así cada misión
 * tiene su propio fondo, ligero y sin depender de un proveedor de imágenes.
 */

/** Tipo de escenario; define la geometría base del fondo. */
export const BACKDROP_KINDS = [
  'office',
  'shop',
  'restaurant',
  'street',
  'transport',
  'campus',
  'home',
  'gym',
  'park',
  'hotel',
  'health',
  'services',
  'generic',
] as const
export type BackdropKind = (typeof BACKDROP_KINDS)[number]

/** Tratamiento visual con el que se pintan las capas. */
export const BACKDROP_STYLES = ['flat', 'diorama', 'blueprint'] as const
export type BackdropStyle = (typeof BACKDROP_STYLES)[number]

/** Momento del día: cambia el cielo, la luz y el contraste. */
export const BACKDROP_LIGHTS = ['day', 'sunset', 'night'] as const
export type BackdropLight = (typeof BACKDROP_LIGHTS)[number]

export interface MissionBackdrop {
  kind: BackdropKind
  style: BackdropStyle
  light: BackdropLight
  /** Tres colores hex `#rrggbb`: cielo/base, media distancia y acento. */
  palette: string[]
  /** Detalles libres y cortos, p. ej. `skyline` o `plants`. */
  props?: string[]
}
