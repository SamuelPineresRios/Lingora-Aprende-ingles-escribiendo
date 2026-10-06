/**
 * Calentado del contenido de una misión.
 *
 * La escena y el vocabulario se generan la primera vez que alguien los pide y
 * quedan cacheados en el backend. Adelantar la petición mientras el alumno
 * está en la lista (al pasar el cursor) o leyendo la cabecera hace que, al
 * llegar a esa fase, la respuesta sea instantánea y no aparezca «Preparando…».
 *
 * Las peticiones son de mejor esfuerzo: si fallan, se olvidan para poder
 * reintentarlas más tarde.
 */
const requested = new Set<string>()

function prewarm(path: string, key: string): void {
  if (requested.has(key)) return
  requested.add(key)

  void fetch(path)
    .then(response => {
      if (!response.ok) requested.delete(key)
    })
    .catch(() => requested.delete(key))
}

/** Pide la escena narrativa de la misión antes de que se abra. */
export function prewarmIntroduction(missionId: string): void {
  prewarm(`/api/missions/${missionId}/introduction`, `intro:${missionId}`)
}

/** Pide el vocabulario clave de la misión antes de que haga falta. */
export function prewarmVocabulary(missionId: string): void {
  prewarm(`/api/missions/${missionId}/vocabulary`, `vocab:${missionId}`)
}
