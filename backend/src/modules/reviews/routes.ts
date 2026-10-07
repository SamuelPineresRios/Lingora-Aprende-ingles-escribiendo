/**
 * Rutas del repaso espaciado (montadas en `/api/students`).
 *
 * - GET  /:id/reviews                  -> repasos que tocan (con su ejercicio)
 * - POST /:id/reviews/:savedId/answer  -> responder (solo el propio alumno)
 */
import { Router } from 'express'
import type { Request } from 'express'
import { ownsResource } from '../../lib/authorization.ts'
import { requireAuth, sessionOf } from '../../middleware/require-auth.ts'
import { HttpError } from '../../utils/http-error.ts'
import { routeParam } from '../../utils/route-params.ts'
import { answerReview, getDueReviews } from './service.ts'

export const reviewsRouter = Router()

function viewerStudent(req: Request): string {
  const session = sessionOf(req)
  const studentId = routeParam(req, 'id')
  if (!ownsResource(session, studentId, ['teacher'])) throw new HttpError(403, 'Forbidden')
  return studentId
}

reviewsRouter.get('/:id/reviews', requireAuth, async (req, res) => {
  res.json(await getDueReviews(viewerStudent(req), req.query.limit))
})

reviewsRouter.post('/:id/reviews/:savedId/answer', requireAuth, async (req, res) => {
  const session = sessionOf(req)
  const studentId = routeParam(req, 'id')
  if (session.role !== 'student' || session.userId !== studentId) throw new HttpError(403, 'Forbidden')

  const body = (req.body ?? {}) as Record<string, unknown>
  res.json(await answerReview(studentId, routeParam(req, 'savedId'), body.option))
})
