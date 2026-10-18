/**
 * Rutas por objetivo (montadas en `/api/students`).
 *
 * - GET /:id/paths  -> itinerarios del nivel del alumno con su progreso
 */
import { Router } from 'express'
import type { Request } from 'express'
import { ownsResource } from '../../lib/authorization.ts'
import { requireAuth, sessionOf } from '../../middleware/require-auth.ts'
import { HttpError } from '../../utils/http-error.ts'
import { routeParam } from '../../utils/route-params.ts'
import { getStudentPaths } from './service.ts'

export const pathsRouter = Router()

/** El alumno de la ruta, si puede verlo (él mismo o un docente). */
function viewerStudent(req: Request): string {
  const session = sessionOf(req)
  const studentId = routeParam(req, 'id')
  if (!ownsResource(session, studentId, ['teacher'])) throw new HttpError(403, 'Forbidden')
  return studentId
}

pathsRouter.get('/:id/paths', requireAuth, async (req, res) => {
  res.json(await getStudentPaths(viewerStudent(req)))
})
