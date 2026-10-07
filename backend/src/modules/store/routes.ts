/**
 * Rutas de la tienda (montadas en `/api/students`).
 *
 * - GET  /:id/store          -> saldo, escudos y catálogo
 * - POST /:id/store/purchase -> comprar (solo el propio alumno)
 * - POST /:id/store/equip    -> ponerse un artículo comprado
 *
 * Ver la tienda de otro alumno lo puede hacer un docente; gastar sus monedas,
 * no: comprar y equipar son actos del alumno.
 */
import { Router } from 'express'
import type { Request } from 'express'
import { ownsResource } from '../../lib/authorization.ts'
import { requireAuth, sessionOf } from '../../middleware/require-auth.ts'
import { HttpError } from '../../utils/http-error.ts'
import { routeParam } from '../../utils/route-params.ts'
import { equipItem, getStudentStore, purchaseItem } from './service.ts'

export const storeRouter = Router()

/** El alumno de la ruta, si puede verlo (él mismo o un docente). */
function viewerStudent(req: Request): string {
  const session = sessionOf(req)
  const studentId = routeParam(req, 'id')
  if (!ownsResource(session, studentId, ['teacher'])) throw new HttpError(403, 'Forbidden')
  return studentId
}

/** El alumno de la ruta, solo si es él (comprar y equipar). */
function ownStudent(req: Request): string {
  const session = sessionOf(req)
  const studentId = routeParam(req, 'id')
  if (session.role !== 'student' || session.userId !== studentId) throw new HttpError(403, 'Forbidden')
  return studentId
}

storeRouter.get('/:id/store', requireAuth, async (req, res) => {
  res.json(await getStudentStore(viewerStudent(req)))
})

storeRouter.post('/:id/store/purchase', requireAuth, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>
  res.json(await purchaseItem(ownStudent(req), body.item_id))
})

storeRouter.post('/:id/store/equip', requireAuth, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>
  res.json(await equipItem(ownStudent(req), body.item_id))
})
