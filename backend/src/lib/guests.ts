/**
 * Política de la cuenta de invitado en un solo sitio.
 *
 * La prueba es real (chat + evaluación con IA), así que tiene un techo:
 * 2 envíos de misión y un presupuesto de llamadas de IA. El submit ya carga
 * al usuario y comprueba el tope sin volver a consultarlo; chat y fichas
 * usan `guardGuestAiRequest`. Los invitados caducan a los 7 días.
 */
import { and, eq, lt, sql } from 'drizzle-orm'
import { GUEST_LIMIT_CODE, GUEST_TRIAL_SUBMISSIONS } from '@vox/shared'
import { db } from '../db/client.ts'
import { responses, users } from '../db/schema.ts'
import { HttpError } from '../utils/http-error.ts'

export const GUEST_AI_CALL_LIMIT = 30
const GUEST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export const GUEST_LIMIT_MESSAGE =
  `Has usado tus ${GUEST_TRIAL_SUBMISSIONS} misiones de prueba. Crea tu cuenta gratis para seguir jugando, generar XP y subir de nivel.`

function guestLimitError(): HttpError {
  return new HttpError(403, GUEST_LIMIT_MESSAGE, GUEST_LIMIT_CODE)
}

export async function isGuestUser(studentId: string): Promise<boolean> {
  const [row] = await db
    .select({ is_guest: users.is_guest })
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1)
  return row?.is_guest === true
}

/** Borra invitados antiguos (sus respuestas y datos caen en cascada). */
export async function cleanupExpiredGuests(): Promise<void> {
  await db
    .delete(users)
    .where(and(eq(users.is_guest, true), lt(users.created_at, new Date(Date.now() - GUEST_MAX_AGE_MS))))
}

async function countResponses(studentId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(responses)
    .where(eq(responses.student_id, studentId))
  return row?.n ?? 0
}

async function assertTrialAvailable(studentId: string): Promise<void> {
  if ((await countResponses(studentId)) >= GUEST_TRIAL_SUBMISSIONS) throw guestLimitError()
}

/** El servicio de submit ya sabe si es invitado: evita otra consulta de usuario. */
export async function assertGuestCanSubmit(studentId: string, isGuest: boolean): Promise<void> {
  if (isGuest) await assertTrialAvailable(studentId)
}

/** Chat y fichas: valida la prueba y consume una llamada del presupuesto de IA. */
export async function guardGuestAiRequest(studentId: string): Promise<void> {
  const [guest] = await db
    .select({ is_guest: users.is_guest })
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1)

  if (!guest?.is_guest) return

  await assertTrialAvailable(studentId)

  // Incremento atómico: dos peticiones simultáneas no se pisan.
  const [updated] = await db
    .update(users)
    .set({ guest_ai_calls: sql`${users.guest_ai_calls} + 1` })
    .where(and(eq(users.id, studentId), eq(users.is_guest, true)))
    .returning({ calls: users.guest_ai_calls })

  if (updated && updated.calls > GUEST_AI_CALL_LIMIT) throw guestLimitError()
}
