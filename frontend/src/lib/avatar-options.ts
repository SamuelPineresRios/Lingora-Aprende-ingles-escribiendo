/**
 * Etiquetas en español de las piezas del avatar.
 *
 * Los `Record` están tipados con los catálogos compartidos: si se añade una
 * variante nueva al estilo, TypeScript obliga a ponerle nombre aquí.
 */
import {
  AVATAR_BEARDS,
  AVATAR_CHEEKS,
  AVATAR_EYEBROWS,
  AVATAR_EYES,
  AVATAR_GLASSES,
  AVATAR_MOUTHS,
  AVATAR_NOSES,
  AVATAR_OUTFITS,
  AVATAR_TOPS,
} from '@vox/shared'

export const TOP_LABELS: Record<(typeof AVATAR_TOPS)[number], string> = {
  afro: 'Afro',
  animalEars: 'Orejas',
  beanie: 'Gorro de lana',
  bob: 'Bob',
  bowl: 'Tazón',
  braids: 'Trenzas',
  bunnyEars: 'Orejas de conejo',
  buns: 'Moños',
  cap: 'Gorra',
  curly: 'Rizado',
  halfShaved: 'Rapado lateral',
  longStraight: 'Largo liso',
  longWavy: 'Largo ondulado',
  mohawk: 'Cresta',
  partedLong: 'Largo con raya',
  ponytail: 'Coleta',
  short: 'Corto',
  shoulderLength: 'Media melena',
  sideSwept: 'Barrido',
  spiky: 'Puntas',
  twinTails: 'Coletas',
}

export const OUTFIT_LABELS: Record<(typeof AVATAR_OUTFITS)[number], string> = {
  checker: 'Cuadros',
  coat: 'Abrigo',
  dress: 'Vestido',
  hoodie: 'Sudadera',
  jacket: 'Chaqueta',
  overalls: 'Peto',
  plain: 'Camiseta',
  stripes: 'Rayas',
  suit: 'Traje',
  tie: 'Corbata',
}

export const EYE_LABELS: Record<(typeof AVATAR_EYES)[number], string> = {
  closed: 'Cerrados',
  happy: 'Felices',
  open: 'Abiertos',
  side: 'De lado',
  sleepy: 'Somnolientos',
  soft: 'Suaves',
  star: 'Estrellas',
  wide: 'Muy abiertos',
}

export const EYEBROW_LABELS: Record<(typeof AVATAR_EYEBROWS)[number], string> = {
  angry: 'Enfadadas',
  flat: 'Rectas',
  raised: 'Levantadas',
  soft: 'Suaves',
}

export const MOUTH_LABELS: Record<(typeof AVATAR_MOUTHS)[number], string> = {
  bigSmile: 'Gran sonrisa',
  flat: 'Recta',
  frown: 'Triste',
  grin: 'Sonrisa pícara',
  laugh: 'Risa',
  ooh: 'Sorprendida',
  smile: 'Sonrisa',
  smirk: 'Pícara',
  tongue: 'Lengua',
  wideSmile: 'Sonrisa ancha',
}

export const NOSE_LABELS: Record<(typeof AVATAR_NOSES)[number], string> = {
  block: 'Cuadrada',
  small: 'Pequeña',
  tall: 'Alta',
  wide: 'Ancha',
}

export const CHEEK_LABELS: Record<(typeof AVATAR_CHEEKS)[number], string> = {
  blush: 'Rubor',
  freckles: 'Pecas',
  pixel: 'Píxeles',
}

export const GLASSES_LABELS: Record<(typeof AVATAR_GLASSES)[number], string> = {
  cat: 'Gato',
  round: 'Redondas',
  shades: 'De sol',
  square: 'Cuadradas',
  visor: 'Visor',
}

export const BEARD_LABELS: Record<(typeof AVATAR_BEARDS)[number], string> = {
  full: 'Completa',
  goatee: 'Perilla',
  mustache: 'Bigote',
  stubble: 'Barba de días',
}
