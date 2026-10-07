/**
 * Tipos de la tienda (el catálogo real lo sirve el backend).
 */
export type StoreItemKind = 'frame' | 'title' | 'theme' | 'shield'

export interface StoreItem {
  id: string
  kind: StoreItemKind
  label: string
  description: string
  price: number
  consumable?: boolean
  colors?: [string, string]
  accent?: string
  text?: string
}

export interface StoreView {
  balance: number
  /** Escudos de racha sin usar. */
  shields: number
  items: Array<StoreItem & { owned: boolean; equipped: boolean }>
  loadout: { frame_id: string | null; title_id: string | null; theme_id: string | null }
}

/** Secciones de la tienda, en orden. */
export const STORE_SECTIONS: Array<{ kind: StoreItemKind; title: string; hint: string }> = [
  { kind: 'frame', title: 'Marcos', hint: 'El anillo de tu avatar.' },
  { kind: 'title', title: 'Títulos', hint: 'Junto a tu nombre en el perfil.' },
  { kind: 'theme', title: 'Temas', hint: 'El color de acento de tu perfil.' },
  { kind: 'shield', title: 'Escudos', hint: 'Consumibles que salvan la racha.' },
]

/** Artículo equipado de una categoría, si lo hay. */
export function equippedItem(view: StoreView | null, kind: 'frame' | 'title' | 'theme') {
  if (!view) return null
  const id =
    kind === 'frame' ? view.loadout.frame_id : kind === 'title' ? view.loadout.title_id : view.loadout.theme_id
  return view.items.find(item => item.id === id) ?? null
}
