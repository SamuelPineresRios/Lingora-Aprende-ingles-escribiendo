/**
 * Catálogo de la tienda de monedas.
 *
 * Es estático (código, no tabla): marcos para el avatar, títulos para el
 * perfil, temas de acento y escudos de racha (consumibles). Los marcos del
 * pase de temporada no se venden: se ganan jugándolo.
 */
export type StoreItemKind = 'frame' | 'title' | 'theme' | 'shield'

/** Títulos que se pueden llevar puestos a la vez. */
export const MAX_TITLES = 3

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
  // Colección de piedras, dragones y abstractos
  {
    id: 'marco-dragon-carmesi',
    kind: 'frame',
    label: 'Marco dragón carmesí',
    description: 'Escamas de dragón sobre brasas.',
    price: 550,
    colors: ['#dc2626', '#f59e0b'],
  },
  {
    id: 'marco-dragon-jade',
    kind: 'frame',
    label: 'Marco dragón jade',
    description: 'Escamas de un dragón antiguo.',
    price: 550,
    colors: ['#059669', '#a7f3d0'],
  },
  {
    id: 'marco-aliento-dragon',
    kind: 'frame',
    label: 'Marco aliento de dragón',
    description: 'Brasas girando en espiral.',
    price: 500,
    colors: ['#f59e0b', '#ef4444'],
  },
  {
    id: 'marco-zafiro',
    kind: 'frame',
    label: 'Marco zafiro',
    description: 'Facetas de piedra preciosa.',
    price: 450,
    colors: ['#2563eb', '#93c5fd'],
  },
  {
    id: 'marco-rubi',
    kind: 'frame',
    label: 'Marco rubí',
    description: 'Facetas encendidas.',
    price: 450,
    colors: ['#dc2626', '#fda4af'],
  },
  {
    id: 'marco-amatista',
    kind: 'frame',
    label: 'Marco amatista',
    description: 'Cuarzo violeta sereno.',
    price: 400,
    colors: ['#7c3aed', '#d8b4fe'],
  },
  {
    id: 'marco-opalo',
    kind: 'frame',
    label: 'Marco ópalo',
    description: 'Iridiscencias que cambian con la luz.',
    price: 500,
    colors: ['#22d3ee', '#f0abfc'],
  },
  {
    id: 'marco-cuarzo-rosa',
    kind: 'frame',
    label: 'Marco cuarzo rosa',
    description: 'Limpio y tranquilo.',
    price: 350,
    colors: ['#f472b6', '#fbcfe8'],
  },
  {
    id: 'marco-obsidiana',
    kind: 'frame',
    label: 'Marco obsidiana',
    description: 'Negro pulido con filo carmesí.',
    price: 400,
    colors: ['#0f172a', '#ef4444'],
  },
  {
    id: 'marco-prisma',
    kind: 'frame',
    label: 'Marco prisma',
    description: 'La luz separada en colores.',
    price: 500,
    colors: ['#6366f1', '#22d3ee'],
  },
  {
    id: 'marco-dragon-dorado',
    kind: 'frame',
    label: 'Marco dragón dorado',
    description: 'Escamas de oro viejo.',
    price: 600,
    colors: ['#b45309', '#fde68a'],
  },
  {
    id: 'marco-perla',
    kind: 'frame',
    label: 'Marco perla',
    description: 'Luz suave con irisaciones.',
    price: 450,
    colors: ['#e2e8f0', '#f0abfc'],
  },
  {
    id: 'marco-topacio',
    kind: 'frame',
    label: 'Marco topacio',
    description: 'Facetas doradas.',
    price: 450,
    colors: ['#f59e0b', '#fef3c7'],
  },
  {
    id: 'marco-aurora',
    kind: 'frame',
    label: 'Marco aurora',
    description: 'Ondas verdes y violetas.',
    price: 500,
    colors: ['#34d399', '#a78bfa'],
  },
  {
    id: 'marco-eclipse',
    kind: 'frame',
    label: 'Marco eclipse',
    description: 'Un filo de sol en la sombra.',
    price: 550,
    colors: ['#f97316', '#0f172a'],
  },
  {
    id: 'marco-estelar',
    kind: 'frame',
    label: 'Marco estelar',
    description: 'Polvo de estrellas girando.',
    price: 500,
    colors: ['#818cf8', '#e0e7ff'],
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
  {
    id: 'titulo-madrugador',
    kind: 'title',
    label: 'Título: Madrugador',
    description: 'Antes que todos.',
    price: 150,
    text: 'Madrugador',
  },
  {
    id: 'titulo-filosofo',
    kind: 'title',
    label: 'Título: Filósofo',
    description: 'Piensa antes de escribir.',
    price: 200,
    text: 'Filósofo',
  },
  {
    id: 'titulo-velocista',
    kind: 'title',
    label: 'Título: Velocista',
    description: 'Rápido y claro.',
    price: 200,
    text: 'Velocista',
  },
  {
    id: 'titulo-perfeccionista',
    kind: 'title',
    label: 'Título: Perfeccionista',
    description: 'Cada coma en su sitio.',
    price: 250,
    text: 'Perfeccionista',
  },
  {
    id: 'titulo-narrador',
    kind: 'title',
    label: 'Título: Narrador',
    description: 'Cuenta todo con detalle.',
    price: 200,
    text: 'Narrador',
  },
  {
    id: 'titulo-diplomatico',
    kind: 'title',
    label: 'Título: Diplomático',
    description: 'Suena bien en cualquier sala.',
    price: 250,
    text: 'Diplomático',
  },
  {
    id: 'titulo-cientifico',
    kind: 'title',
    label: 'Título: Científico',
    description: 'Precisión de laboratorio.',
    price: 250,
    text: 'Científico',
  },
  {
    id: 'titulo-sonador',
    kind: 'title',
    label: 'Título: Soñador',
    description: 'Escribe con la cabeza en las nubes.',
    price: 150,
    text: 'Soñador',
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
  { id: 'tema-coral', kind: 'theme', label: 'Tema coral', description: 'Cálido y directo.', price: 200, accent: '#f87171' },
  { id: 'tema-rosa', kind: 'theme', label: 'Tema rosa', description: 'Con carácter.', price: 250, accent: '#f472b6' },
  { id: 'tema-azul', kind: 'theme', label: 'Tema azul', description: 'Sereno y clásico.', price: 200, accent: '#3b82f6' },
  { id: 'tema-turquesa', kind: 'theme', label: 'Tema turquesa', description: 'Fresco y luminoso.', price: 250, accent: '#2dd4bf' },
  { id: 'tema-celeste', kind: 'theme', label: 'Tema celeste', description: 'Azul claro, sereno.', price: 250, accent: '#7dd3fc' },
  { id: 'tema-lima', kind: 'theme', label: 'Tema lima', description: 'Energía pura.', price: 250, accent: '#a3e635' },
  { id: 'tema-magenta', kind: 'theme', label: 'Tema magenta', description: 'Para destacar.', price: 300, accent: '#d946ef' },
  { id: 'tema-hielo', kind: 'theme', label: 'Tema hielo', description: 'Limpio y frío.', price: 250, accent: '#e2e8f0' },
  { id: 'tema-oro', kind: 'theme', label: 'Tema oro', description: 'Brillo de trofeo.', price: 300, accent: '#fbbf24' },
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
