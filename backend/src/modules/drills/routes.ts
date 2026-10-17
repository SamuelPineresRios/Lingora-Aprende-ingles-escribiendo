/**
 * Rutas de puntos débiles (montadas en `/api/students`).
 *
 * - GET /:id/weaknesses  -> errores más repetidos y sesión de drills
 */
import { Router } from 'express'
import type { Request } from 'express'
import { ownsResource } from '../../lib/authorization.ts'
import { requireAuth, sessionOf } from '../../middleware/require-auth.ts'
import { HttpError } from '../../utils/http-error.ts'
import { routeParam } from '../../utils/route-params.ts'
import { getWeaknessReport } from './service.ts'

export const drillsRouter = Router()

/** El alumno de la ruta, si puede verlo (él mismo o un docente). */
function viewerStudent(req: Request): string {
  const session = sessionOf(req)
  const studentId = routeParam(req, 'id')
  if (!ownsResource(session, studentId, ['teacher'])) throw new HttpError(403, 'Forbidden')
  return studentId
}

drillsRouter.get('/:id/weaknesses', requireAuth, async (req, res) => {
  res.json(await getWeaknessReport(viewerStudent(req)))
})
