/**
 * Avatar de un personaje: voxel-art animado de DiceBear (licencia CC0).
 *
 * `tags=animation` activa el parpadeo y la respiración por CSS (respetan
 * `prefers-reduced-motion`) y el alfa `00` del fondo deja el lienzo
 * transparente: el estilo trae por defecto un fondo lila que chocaría con la
 * escena oscura. El mismo seed da siempre el mismo personaje, así que la
 * escena narrativa y el chat dibujan al mismo con la misma URL.
 */
export function avatarUrl(name: string): string {
  return `https://api.dicebear.com/10.x/voxel-art/svg?seed=${encodeURIComponent(name)}&tags=animation&flip=horizontal&backgroundColor=00000000`
}
