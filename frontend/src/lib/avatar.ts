/**
 * URLs de avatar (voxel-art de DiceBear, licencia CC0).
 *
 * Dos caminos: `studentAvatarUrl` pinta el personaje personalizable del
 * alumno (cada pieza fija, así el look no baila) y `characterAvatarUrl` pinta
 * los personajes de misión, que no se personalizan: mismo seed y presets por
 * género para que la escena y el chat dibujen al mismo con la misma URL.
 *
 * `tags=animation` activa el parpadeo y la respiración por CSS (respetan
 * `prefers-reduced-motion`) y el alfa `00` del fondo deja el lienzo
 * transparente: el estilo trae por defecto un fondo lila que chocaría con la
 * escena oscura.
 */
import type { UserAvatar } from '@vox/shared'

export type AvatarGender = 'male' | 'female'

/** Pelo corto, algo de barba y sin vestidos. */
const MALE_LOOK =
  'topVariant=afro,bowl,curly,halfShaved,mohawk,short,sideSwept,spiky&topProbability=100' +
  '&beardProbability=30' +
  '&outfitVariant=jacket,hoodie,plain,stripes,suit,coat,overalls,tie,checker&outfitProbability=100'

/** Pelo largo o recogido, sin barba y con vestido entre las opciones. */
const FEMALE_LOOK =
  'topVariant=bob,braids,buns,longStraight,longWavy,partedLong,ponytail,shoulderLength,twinTails&topProbability=100' +
  '&beardProbability=0' +
  '&outfitVariant=dress,jacket,hoodie,plain,stripes,coat,overalls,checker&outfitProbability=100'

function avatarEndpoint(seed: string): string {
  return `https://api.dicebear.com/10.x/voxel-art/svg?seed=${encodeURIComponent(seed)}&tags=animation&flip=horizontal&backgroundColor=00000000`
}

/** Personaje de misión (no personalizable): nombre + preset de género. */
export function characterAvatarUrl(name: string, gender?: AvatarGender): string {
  const base = avatarEndpoint(name)
  if (gender === 'male') return `${base}&${MALE_LOOK}`
  if (gender === 'female') return `${base}&${FEMALE_LOOK}`
  return base
}

/**
 * Personaje del alumno: todas las piezas van fijas. Las opcionales que no se
 * eligen se apagan con probabilidad 0 para que no aparezcan por sorpresa.
 */
export function studentAvatarUrl(avatar: UserAvatar): string {
  const params = new URLSearchParams({
    seed: avatar.seed,
    tags: 'animation',
    flip: 'horizontal',
    backgroundColor: '00000000',
    topVariant: avatar.top,
    topProbability: '100',
    hairColor: avatar.topColor,
    skinColor: avatar.skinColor,
    outfitVariant: avatar.outfit,
    outfitProbability: '100',
    shirtColor: avatar.shirtColor,
    jacketColor: avatar.jacketColor,
    pantsColor: avatar.pantsColor,
    shoesColor: avatar.shoesColor,
    hatColor: avatar.hatColor,
    eyesVariant: avatar.eyes,
    eyesProbability: '100',
    eyebrowsVariant: avatar.eyebrows,
    eyebrowsProbability: '100',
    mouthVariant: avatar.mouth,
    mouthProbability: '100',
    noseVariant: avatar.nose,
    noseProbability: '100',
    cheeksProbability: avatar.cheeks ? '100' : '0',
    glassesProbability: avatar.glasses ? '100' : '0',
    beardProbability: avatar.beard ? '100' : '0',
  })

  if (avatar.cheeks) params.set('cheeksVariant', avatar.cheeks)
  if (avatar.glasses) params.set('glassesVariant', avatar.glasses)
  if (avatar.beard) params.set('beardVariant', avatar.beard)

  return `https://api.dicebear.com/10.x/voxel-art/svg?${params.toString()}`
}

/** Avatares ya pedidos: pedir dos veces la misma URL no aporta nada. */
const preloaded = new Set<string>()

/** Precalienta una URL concreta (por ejemplo, el personaje del alumno). */
export function preloadAvatar(url: string): void {
  if (typeof window === 'undefined' || preloaded.has(url)) return
  preloaded.add(url)
  const image = new Image()
  image.src = url
  void image.decode?.().catch(() => {})
}

/**
 * Precalienta los avatares de misión mientras se ve la cabecera: cuando la
 * escena entra, las imágenes ya están en la caché del navegador (DiceBear
 * responde con `max-age` de un año) y no aparecen vacías un instante.
 */
export function preloadAvatars(people: Array<{ name: string; gender?: AvatarGender }>): void {
  for (const person of people) preloadAvatar(characterAvatarUrl(person.name, person.gender))
}
