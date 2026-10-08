/**
 * Validación del avatar del alumno.
 *
 * Todo se comprueba contra los catálogos compartidos: variantes exactas y
 * colores hex de seis dígitos. Cualquier clave desconocida o valor fuera del
 * catálogo se rechaza con 400, de modo que a la base solo llega un avatar
 * completo y válido (nunca a medio normalizar).
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
  type UserAvatar,
} from '@vox/shared'
import { HttpError } from '../utils/http-error.ts'

const HEX_COLOR = /^[0-9a-f]{6}$/i
const MAX_SEED_LENGTH = 64

const KEYS = [
  'seed',
  'top',
  'topColor',
  'skinColor',
  'outfit',
  'shirtColor',
  'jacketColor',
  'pantsColor',
  'shoesColor',
  'hatColor',
  'eyes',
  'eyebrows',
  'mouth',
  'nose',
  'cheeks',
  'glasses',
  'beard',
] as const

function oneOf<T extends string>(values: readonly T[], value: unknown, field: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new HttpError(400, `${field} no es una opción válida`)
  }
  return value as T
}

/** Igual que `oneOf`, pero admite `null` para las piezas opcionales. */
function oneOfOrNone<T extends string>(values: readonly T[], value: unknown, field: string): T | null {
  if (value === null) return null
  return oneOf(values, value, field)
}

function hex(value: unknown, field: string): string {
  if (typeof value !== 'string' || !HEX_COLOR.test(value)) {
    throw new HttpError(400, `${field} debe ser un color hex de 6 dígitos`)
  }
  return value.toLowerCase()
}

export function normalizeAvatar(input: unknown): UserAvatar {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new HttpError(400, 'Avatar inválido')
  }

  const raw = input as Record<string, unknown>
  for (const key of Object.keys(raw)) {
    if (!KEYS.includes(key as (typeof KEYS)[number])) {
      throw new HttpError(400, `Campo de avatar desconocido: ${key}`)
    }
  }

  if (typeof raw.seed !== 'string' || raw.seed.length === 0 || raw.seed.length > MAX_SEED_LENGTH) {
    throw new HttpError(400, 'seed no válida')
  }

  return {
    seed: raw.seed,
    top: oneOf(AVATAR_TOPS, raw.top, 'top'),
    topColor: hex(raw.topColor, 'topColor'),
    skinColor: hex(raw.skinColor, 'skinColor'),
    outfit: oneOf(AVATAR_OUTFITS, raw.outfit, 'outfit'),
    shirtColor: hex(raw.shirtColor, 'shirtColor'),
    jacketColor: hex(raw.jacketColor, 'jacketColor'),
    pantsColor: hex(raw.pantsColor, 'pantsColor'),
    shoesColor: hex(raw.shoesColor, 'shoesColor'),
    hatColor: hex(raw.hatColor, 'hatColor'),
    eyes: oneOf(AVATAR_EYES, raw.eyes, 'eyes'),
    eyebrows: oneOf(AVATAR_EYEBROWS, raw.eyebrows, 'eyebrows'),
    mouth: oneOf(AVATAR_MOUTHS, raw.mouth, 'mouth'),
    nose: oneOf(AVATAR_NOSES, raw.nose, 'nose'),
    cheeks: oneOfOrNone(AVATAR_CHEEKS, raw.cheeks, 'cheeks'),
    glasses: oneOfOrNone(AVATAR_GLASSES, raw.glasses, 'glasses'),
    beard: oneOfOrNone(AVATAR_BEARDS, raw.beard, 'beard'),
  }
}
