/**
 * Vista de la tienda compartida: una sola carga por sesión.
 *
 * El perfil necesita el catálogo completo (marco, título y tema equipados),
 * pero el color del tema lo consumen también la barra lateral, la barra de
 * XP y la gráfica. Este módulo carga `/store` una vez, guarda la vista y
 * avisa a todos los que la usan; así, al equipar un tema en la tienda, el
 * cambio se refleja al momento en toda la interfaz.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { readJson } from '@/lib/api'
import type { StoreView } from '@/lib/store'

let view: StoreView | null = null
let loadedFor: string | null = null
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach(listener => listener())

/** La tienda y el perfil publican la vista que reciben para refrescar a todos. */
export function publishStoreView(next: StoreView | null, studentId?: string) {
  view = next
  if (studentId) loadedFor = studentId
  notify()
}

function ensureView(studentId: string) {
  if (loadedFor === studentId || inflight) return
  loadedFor = studentId
  view = null
  notify()
  inflight = fetch(`/api/students/${studentId}/store`)
    .then(readJson<StoreView>)
    .then(data => {
      view = data ?? null
      notify()
    })
    .catch(() => {
      // Sin tienda, todo queda en los colores por defecto.
    })
    .finally(() => {
      inflight = null
    })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return view
}

export function useStoreView(studentId: string | undefined): StoreView | null {
  const value = useSyncExternalStore(subscribe, getSnapshot)

  useEffect(() => {
    if (studentId) ensureView(studentId)
  }, [studentId])

  return value
}

/** Acento del tema equipado (`null` deja los colores de siempre). */
export function useThemeAccent(studentId: string | undefined): string | null {
  const store = useStoreView(studentId)
  const themeId = store?.loadout.theme_id ?? null
  return store?.items.find(item => item.id === themeId)?.accent ?? null
}
