/**
 * Catálogo de la tienda de monedas.
 *
 * Es estático (código, no tabla): marcos para el avatar, títulos para el
 * perfil, temas de acento y escudos de racha (consumibles). Los marcos del
 * pase de temporada no se venden: se ganan jugándolo.
 */
export type StoreItemKind = 'frame' | 'title' | 'theme' | 'shield'

export interface StoreItem {
  id: string
  kind: StoreItemKind
  label: string
  description: string
  price: number
  /** Se puede comprar varias veces (escudos). */
  consumable?: boolean
  /** Marco: colores del degradado del anillo. */
  colors?: [string, string]
  /** Tema: color de acento del perfil. */
  accent?: string
  /** Título: texto que se muestra junto al nombre. */
  text?: string
}

export const STORE_ITEMS: StoreItem[] = [
  // Marcos
  {
    id: 'marco-fuego',
    kind: 'frame',
    label: 'Marco de fuego',
    description: 'Rojo y ámbar, para rachas encendidas.',
    price: 400,
    colors: ['#dc2626', '#f59e0b'],
  },
  {
    id: 'marco-esmeralda',
    kind: 'frame',
    label: 'Marco esmeralda',
    description: 'El verde sereno de quien no falla.',
    price: 400,
    colors: ['#059669', '#6ee7b7'],
  },
  {
    id: 'marco-neon',
    kind: 'frame',
    label: 'Marco neón',
    description: 'Cian y violeta, puro arcade.',
    price: 500,
    colors: ['#06b6d4', '#a855f7'],
  },
  {
    id: 'marco-medianoche',
    kind: 'frame',
    label: 'Marco medianoche',
    description: 'Discreto y elegante.',
    price: 300,
    colors: ['#1e293b', '#94a3b8'],
  },
  // Títulos
  {
    id: 'titulo-constante',
    kind: 'title',
    label: 'Título: Constante',
    description: 'Para quien aparece todos los días.',
    price: 150,
    text: 'Constante',
  },
  {
    id: 'titulo-explorador',
    kind: 'title',
    label: 'Título: Explorador',
    description: 'Cada misión es un sitio nuevo.',
    price: 150,
    text: 'Explorador',
  },
  {
    id: 'titulo-noctambulo',
    kind: 'title',
    label: 'Título: Noctámbulo',
    description: 'Inglés a medianoche.',
    price: 200,
    text: 'Noctámbulo',
  },
  {
    id: 'titulo-poliglota',
    kind: 'title',
    label: 'Título: Políglota',
    description: 'Dos idiomas y subiendo.',
    price: 250,
    text: 'Políglota',
  },
  // Temas del perfil
  { id: 'tema-cian', kind: 'theme', label: 'Tema cian', description: 'El clásico.', price: 200, accent: '#06b6d4' },
  { id: 'tema-violeta', kind: 'theme', label: 'Tema violeta', description: 'Creativo.', price: 250, accent: '#8b5cf6' },
  { id: 'tema-ambar', kind: 'theme', label: 'Tema ámbar', description: 'Cálido.', price: 250, accent: '#f59e0b' },
  {
    id: 'tema-esmeralda',
    kind: 'theme',
    label: 'Tema esmeralda',
    description: 'Fresco.',
    price: 250,
    accent: '#10b981',
  },
  // Consumible
  {
    id: 'escudo-racha',
    kind: 'shield',
    label: 'Escudo de racha',
    description: 'Salva un día perdido sin romper la racha.',
    price: 150,
    consumable: true,
  },
]

export function findStoreItem(id: string): StoreItem | undefined {
  return STORE_ITEMS.find(item => item.id === id)
}
