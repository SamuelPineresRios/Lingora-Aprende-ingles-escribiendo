/**
 * Rutas del evento de fin de semana (montadas en `/api/students`).
 *
 * - GET /:id/event?tz=  -> estado del evento (activo o cuenta atrás)
 */
import { Router } from 'express'
import type { Request } from 'express'
import { ownsResource } from '../../lib/authorization.ts'
import { requireAuth, sessionOf } from '../../middleware/require-auth.ts'
import { HttpError } from '../../utils/http-error.ts'
import { routeParam } from '../../utils/route-params.ts'
import { safeTimeZone, todayKeyIn } from '../../lib/date-keys.ts'
import { weekendEventState } from './service.ts'

export const eventsRouter = Router()

/** El alumno de la ruta, si puede verlo (él mismo o un docente). */
function viewerStudent(req: Request): string {
  const session = sessionOf(req)
  const studentId = routeParam(req, 'id')
  if (!ownsResource(session, studentId, ['teacher'])) throw new HttpError(403, 'Forbidden')
  return studentId
}

eventsRouter.get('/:id/event', requireAuth, async (req, res) => {
  const studentId = viewerStudent(req)
  const dayKey = todayKeyIn(safeTimeZone(req.query.tz))
  res.json(await weekendEventState(studentId, dayKey))
})
