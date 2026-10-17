/**
 * Claves de fecha en la zona del alumno.
 *
 * Todo lo que cuenta «hoy» o «esta semana» lo hace con estas claves: sin la
 * zona horaria, un envío de las 20:00 en Bogotá contaría al día siguiente si
 * la base de datos vive en UTC.
 */

/** Zona horaria IANA válida, o null para usar la de la base de datos. */
export function safeTimeZone(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) return null
  // Solo nombres IANA: así puede incrustarse como literal SQL sin riesgo.
  if (!/^[A-Za-z0-9_+/-]+$/.test(value)) return null
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return value
  } catch {
    return null
  }
}

/** `YYYY-MM-DD` de hoy en la zona del alumno (o en la del servidor). */
export function todayKeyIn(timeZone: string | null): string {
  if (!timeZone) {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }
  // en-CA formatea justo como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())
}

/** Resta días a una clave `YYYY-MM-DD` (en UTC, para no bailar con el DST). */
export function minusDays(key: string, days: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10)
}

/** Lunes de la semana de una clave `YYYY-MM-DD`. */
export function mondayKeyOf(key: string): string {
  const date = new Date(`${key}T00:00:00Z`)
  const fromMonday = (date.getUTCDay() + 6) % 7
  return minusDays(key, fromMonday)
}

/** Semana ISO de una clave `YYYY-MM-DD`, como `2026-W41`. */
export function weekKeyOf(key: string): string {
  // El jueves de la semana define el año y el número (norma ISO-8601).
  const date = new Date(`${key}T00:00:00Z`)
  const fromMonday = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() + 3 - fromMonday)

  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const firstFromMonday = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 3 - firstFromMonday)

  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000))
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}
