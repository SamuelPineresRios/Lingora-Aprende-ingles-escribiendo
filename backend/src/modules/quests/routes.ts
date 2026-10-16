/**
 * Rutas de retos (montadas en `/api/students`).
 *
 * - GET  /:id/quests                       -> retos del día y de la semana
 * - POST /:id/quests/:questId/claim        -> reclamar (solo el propio alumno)
 *
 * La zona horaria del cliente llega por `?tz=` para que «hoy» y «esta semana»
 * coincidan con las suyas.
 */
import { Router } from 'express'
import type { Request } from 'express'
import { ownsResource } from '../../lib/authorization.ts'
import { requireAuth, sessionOf } from '../../middleware/require-auth.ts'
import { HttpError } from '../../utils/http-error.ts'
import { routeParam } from '../../utils/route-params.ts'
import { claimQuest, getStudentQuests, spinSurprise } from './service.ts'

export const questsRouter = Router()

/** El alumno de la ruta, si puede verlo (él mismo o un docente). */
function viewerStudent(req: Request): string {
  const session = sessionOf(req)
  const studentId = routeParam(req, 'id')
  if (!ownsResource(session, studentId, ['teacher'])) throw new HttpError(403, 'Forbidden')
  return studentId
}

questsRouter.get('/:id/quests', requireAuth, async (req, res) => {
  res.json(await getStudentQuests(viewerStudent(req), req.query.tz))
})

questsRouter.post('/:id/quests/:questId/claim', requireAuth, async (req, res) => {
  const session = sessionOf(req)
  const studentId = routeParam(req, 'id')
  if (session.role !== 'student' || session.userId !== studentId) throw new HttpError(403, 'Forbidden')

  res.json(await claimQuest(studentId, routeParam(req, 'questId'), req.query.tz))
})

questsRouter.post('/:id/quests/surprise', requireAuth, async (req, res) => {
  const session = sessionOf(req)
  const studentId = routeParam(req, 'id')
  if (session.role !== 'student' || session.userId !== studentId) throw new HttpError(403, 'Forbidden')

  res.json(await spinSurprise(studentId, req.query.tz))
})
