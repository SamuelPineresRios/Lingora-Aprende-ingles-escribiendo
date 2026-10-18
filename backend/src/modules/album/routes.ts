/**
 * Rutas del álbum (montadas en `/api/students`).
 *
 * - GET /:id/album  -> cartas desbloqueadas y colecciones por nivel
 */
import { Router } from 'express'
import type { Request } from 'express'
import { ownsResource } from '../../lib/authorization.ts'
import { requireAuth, sessionOf } from '../../middleware/require-auth.ts'
import { HttpError } from '../../utils/http-error.ts'
import { routeParam } from '../../utils/route-params.ts'
import { getAlbum } from './service.ts'

export const albumRouter = Router()

/** El alumno de la ruta, si puede verlo (él mismo o un docente). */
function viewerStudent(req: Request): string {
  const session = sessionOf(req)
  const studentId = routeParam(req, 'id')
  if (!ownsResource(session, studentId, ['teacher'])) throw new HttpError(403, 'Forbidden')
  return studentId
}

albumRouter.get('/:id/album', requireAuth, async (req, res) => {
  res.json(await getAlbum(viewerStudent(req)))
})
