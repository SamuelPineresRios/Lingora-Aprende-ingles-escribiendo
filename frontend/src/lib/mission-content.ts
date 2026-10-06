/**
 * Contenido de misión en memoria y calentado en segundo plano.
 *
 * La escena y el vocabulario se generan una vez y quedan cacheados en el
 * backend. Además, la interfaz los pide con antelación (al mostrar las
 * tarjetas, al pasar el cursor y al leer la cabecera) y **guarda la
 * respuesta**: cuando el alumno llega a esa fase, el estado inicial ya la
 * tiene y no hay ninguna espera, ni siquiera el parpadeo de un spinner.
 *
 * La caché es de sesión (se pierde al recargar) y de mejor esfuerzo: si una
 * petición falla, se olvida para poder reintentarla más tarde.
 */
import type { MissionIntroduction } from '@vox/shared'

/** Palabra clave tal como la devuelve el backend. */
export interface KeyWord {
  word: string
  translation: string
  example: string
  example_translation: string
}

const introductions = new Map<string, MissionIntroduction>()
const vocabularies = new Map<string, KeyWord[]>()
/** Peticiones en curso: no repetir la misma mientras no conteste. */
const inFlight = new Set<string>()

function request(path: string, key: string, apply: (data: unknown) => void): void {
  if (inFlight.has(key)) return
  inFlight.add(key)

  void fetch(path)
    .then(async response => {
      if (response.ok) apply(await response.json())
    })
    .catch(() => {})
    .finally(() => inFlight.delete(key))
}

export function getCachedIntroduction(missionId: string): MissionIntroduction | undefined {
  return introductions.get(missionId)
}

export function setCachedIntroduction(missionId: string, introduction: MissionIntroduction): void {
  introductions.set(missionId, introduction)
}

/** Pide la escena narrativa de la misión antes de que se abra. */
export function prewarmIntroduction(missionId: string): void {
  if (introductions.has(missionId)) return
  request(`/api/missions/${missionId}/introduction`, `intro:${missionId}`, data => {
    const introduction = (data as { introduction?: MissionIntroduction }).introduction
    if (introduction) introductions.set(missionId, introduction)
  })
}

export function getCachedVocabulary(missionId: string): KeyWord[] | undefined {
  return vocabularies.get(missionId)
}

export function setCachedVocabulary(missionId: string, words: KeyWord[]): void {
  vocabularies.set(missionId, words)
}

/** Pide el vocabulario clave de la misión antes de que haga falta. */
export function prewarmVocabulary(missionId: string): void {
  if (vocabularies.has(missionId)) return
  request(`/api/missions/${missionId}/vocabulary`, `vocab:${missionId}`, data => {
    const words = (data as { vocabulary?: { words?: KeyWord[] } }).vocabulary?.words
    if (words && words.length > 0) vocabularies.set(missionId, words)
  })
}
