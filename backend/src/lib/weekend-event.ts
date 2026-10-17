/**
 * Evento de fin de semana: una escena especial por nivel, con doble XP y un
 * marco exclusivo al completarla entre el sábado y el domingo.
 *
 * La ventana se calcula con la clave de día del alumno (`YYYY-MM-DD` en su
 * zona): así el evento empieza a su medianoche y no a la del servidor.
 */
export const WEEKEND_EVENT = {
  /** Porcentaje de XP al completar la escena del evento (200 = doble). */
  xp_percent: 200,
  /** Marco exclusivo que se gana al completarla ese fin de semana. */
  frame_id: 'marco-finde',
  frame_label: 'Marco Fin de Semana',
  /**
   * La escena del evento por nivel: la más social de cada uno. Completarla
   * en sábado o domingo da el doble de XP y el marco exclusivo.
   */
  missions: {
    A1: 'm-004',
    A2: 'm-023',
    B1: 'm-132',
    B2: 'm-050',
    C1: 'm-071',
  } as Record<string, string>,
}

/** ¿La clave de día cae en fin de semana? (Sábado o domingo, en UTC-noon). */
export function isWeekendKey(dayKey: string): boolean {
  const date = new Date(`${dayKey}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return false
  const day = date.getUTCDay()
  return day === 0 || day === 6
}

/** Misión del evento para un nivel; null si el nivel no tiene escena asignada. */
export function eventMissionFor(cefrLevel: string | null | undefined): string | null {
  if (!cefrLevel) return null
  return WEEKEND_EVENT.missions[cefrLevel] ?? null
}
