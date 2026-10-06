/**
 * Avatar de un personaje: voxel-art animado de DiceBear (licencia CC0).
 *
 * `tags=animation` activa el parpadeo y la respiración por CSS (respetan
 * `prefers-reduced-motion`) y el alfa `00` del fondo deja el lienzo
 * transparente: el estilo trae por defecto un fondo lila que chocaría con la
 * escena oscura. El mismo seed da siempre el mismo personaje, así que la
 * escena narrativa y el chat dibujan al mismo con la misma URL.
 *
 * El estilo no tiene un parámetro de género: cuando se conoce (lo decide el
 * modelo al escribir la escena), se acotan los peinados, la barba y la ropa
 * para que el personaje se lea acorde al nombre.
 */
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

export function avatarUrl(name: string, gender?: AvatarGender): string {
  const base = `https://api.dicebear.com/10.x/voxel-art/svg?seed=${encodeURIComponent(name)}&tags=animation&flip=horizontal&backgroundColor=00000000`
  if (gender === 'male') return `${base}&${MALE_LOOK}`
  if (gender === 'female') return `${base}&${FEMALE_LOOK}`
  return base
}
