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
import { ALBUM_LEVELS, getAlbum, type AlbumLevel } from './service.ts'

export const albumRouter = Router()

/** El alumno de la ruta, si puede verlo (él mismo o un docente). */
function viewerStudent(req: Request): string {
  const session = sessionOf(req)
  const studentId = routeParam(req, 'id')
  if (!ownsResource(session, studentId, ['teacher'])) throw new HttpError(403, 'Forbidden')
  return studentId
}

albumRouter.get('/:id/album', requireAuth, async (req, res) => {
  const rawLevel = typeof req.query.level === 'string' ? req.query.level.toUpperCase() : 'ALL'
  if (rawLevel !== 'ALL' && !(ALBUM_LEVELS as readonly string[]).includes(rawLevel)) {
    throw new HttpError(400, 'Nivel inválido')
  }
  const rawPage = Number(req.query.page ?? 1)
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1

  res.json(await getAlbum(viewerStudent(req), {
    level: rawLevel === 'ALL' ? null : (rawLevel as AlbumLevel),
    page,
  }))
})
