/**
 * Pase de temporada compartido: una sola carga por sesión.
 *
 * El perfil y el editor de avatar necesitan el marco activo del pase (el del
 * pase se pinta si no hay uno de tienda). Igual que la tienda, se carga una
 * vez y se publica desde la página del pase para que al reclamar recompensas
 * el resto se entere sin recargar.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { readJson } from '@/lib/api'
import type { SeasonProgress } from '@/lib/season'

let progress: SeasonProgress | null = null
let loadedFor: string | null = null
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach(listener => listener())

/** La página del pase publica su progreso para refrescar a todos. */
export function publishSeasonProgress(next: SeasonProgress | null, studentId?: string) {
  progress = next
  if (studentId) loadedFor = studentId
  notify()
}

function ensureProgress(studentId: string) {
  if (loadedFor === studentId || inflight) return
  loadedFor = studentId
  progress = null
  notify()
  inflight = fetch(`/api/students/${studentId}/season`)
    .then(readJson<SeasonProgress>)
    .then(data => {
      progress = data ?? null
      notify()
    })
    .catch(() => {
      // Sin pase, el perfil y el editor siguen funcionando sin recompensas.
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
  return progress
}

export function useSeasonProgress(studentId: string | undefined): SeasonProgress | null {
  const value = useSyncExternalStore(subscribe, getSnapshot)

  useEffect(() => {
    if (studentId) ensureProgress(studentId)
  }, [studentId])

  return value
}
