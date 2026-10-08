/**
 * Avatar del alumno: mismo personaje voxel-art con piezas editables.
 *
 * DiceBear dibuja un personaje estable a partir de `seed`, pero lo que no se
 * fija lo sortea el seed (y podría cambiar entre versiones del estilo), así
 * que aquí se fijan todas las piezas editables: pelo, piel, ropa y cara. El
 * registro guarda el skin base ya resuelto y el editor solo pisa lo que el
 * alumno toca.
 *
 * Estos catálogos son la fuente única: el validador del backend y el editor
 * del frontend comparten exactamente los mismos valores y colores.
 */

export const AVATAR_TOPS = [
  'afro',
  'animalEars',
  'beanie',
  'bob',
  'bowl',
  'braids',
  'bunnyEars',
  'buns',
  'cap',
  'curly',
  'halfShaved',
  'longStraight',
  'longWavy',
  'mohawk',
  'partedLong',
  'ponytail',
  'short',
  'shoulderLength',
  'sideSwept',
  'spiky',
  'twinTails',
] as const

export const AVATAR_OUTFITS = [
  'checker',
  'coat',
  'dress',
  'hoodie',
  'jacket',
  'overalls',
  'plain',
  'stripes',
  'suit',
  'tie',
] as const

export const AVATAR_EYES = ['closed', 'happy', 'open', 'side', 'sleepy', 'soft', 'star', 'wide'] as const
export const AVATAR_EYEBROWS = ['angry', 'flat', 'raised', 'soft'] as const
export const AVATAR_MOUTHS = ['bigSmile', 'flat', 'frown', 'grin', 'laugh', 'ooh', 'smile', 'smirk', 'tongue', 'wideSmile'] as const
export const AVATAR_NOSES = ['block', 'small', 'tall', 'wide'] as const
export const AVATAR_CHEEKS = ['blush', 'freckles', 'pixel'] as const
export const AVATAR_GLASSES = ['cat', 'round', 'shades', 'square', 'visor'] as const
export const AVATAR_BEARDS = ['full', 'goatee', 'mustache', 'stubble'] as const

/** Paletas curadas (hex sin `#`): el editor solo ofrece estos tonos. */
export const AVATAR_SKIN_COLORS = [
  'f2d6c0',
  'e8c39e',
  'd9a066',
  'c68642',
  'a5673f',
  '8d5524',
  '6b4226',
  '4a2c17',
] as const

export const AVATAR_HAIR_COLORS = [
  '26190f',
  '3b2314',
  '5c3a21',
  '8b4513',
  'b07d3f',
  'd9b382',
  'e8d5a3',
  'b9b9c0',
  'e63946',
  '7b2cbf',
  '2a9d8f',
  'f59e0b',
] as const

export const AVATAR_CLOTHES_COLORS = [
  '06b6d4',
  '8b5cf6',
  'f59e0b',
  '10b981',
  'f43f5e',
  'f472b6',
  '3b82f6',
  'e2e8f0',
  '94a3b8',
  '1e293b',
  '111827',
  'ffffff',
] as const

export interface UserAvatar {
  seed: string
  top: (typeof AVATAR_TOPS)[number]
  /** Color del pelo. */
  topColor: string
  skinColor: string
  outfit: (typeof AVATAR_OUTFITS)[number]
  shirtColor: string
  jacketColor: string
  pantsColor: string
  shoesColor: string
  /** Aplica a gorras y gorros de lana. */
  hatColor: string
  eyes: (typeof AVATAR_EYES)[number]
  eyebrows: (typeof AVATAR_EYEBROWS)[number]
  mouth: (typeof AVATAR_MOUTHS)[number]
  nose: (typeof AVATAR_NOSES)[number]
  cheeks: (typeof AVATAR_CHEEKS)[number] | null
  glasses: (typeof AVATAR_GLASSES)[number] | null
  beard: (typeof AVATAR_BEARDS)[number] | null
}

/** FNV-1a de 32 bits: convierte el seed en un entero estable. */
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** PRNG determinista (mulberry32): mismo seed, mismo personaje. */
function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] as T
}

/** Skin base del usuario: cada pieza sale del seed, así nunca baila. */
export function baseAvatar(seed: string): UserAvatar {
  const random = mulberry32(hashSeed(seed))
  return {
    seed,
    top: pick(AVATAR_TOPS, random),
    topColor: pick(AVATAR_HAIR_COLORS, random),
    skinColor: pick(AVATAR_SKIN_COLORS, random),
    outfit: pick(AVATAR_OUTFITS, random),
    shirtColor: pick(AVATAR_CLOTHES_COLORS, random),
    jacketColor: pick(AVATAR_CLOTHES_COLORS, random),
    pantsColor: pick(AVATAR_CLOTHES_COLORS, random),
    shoesColor: pick(AVATAR_CLOTHES_COLORS, random),
    hatColor: pick(AVATAR_CLOTHES_COLORS, random),
    eyes: pick(AVATAR_EYES, random),
    eyebrows: pick(AVATAR_EYEBROWS, random),
    mouth: pick(AVATAR_MOUTHS, random),
    nose: pick(AVATAR_NOSES, random),
    cheeks: pick([...AVATAR_CHEEKS, null], random),
    glasses: pick([...AVATAR_GLASSES, null], random),
    beard: pick([...AVATAR_BEARDS, null], random),
  }
}

/** Avatar del usuario: el guardado o, si aún no personalizó, su skin base. */
export function resolveAvatar(user: { id: string; avatar?: UserAvatar | null }): UserAvatar {
  return user.avatar ?? baseAvatar(user.id)
}

/** Seed nueva para «Sorpréndeme»: baraja todas las piezas sin tocar las demás. */
export function randomAvatarSeed(): string {
  return Math.random().toString(36).slice(2, 12)
}
