/**
 * Autorización por ruta (defensa en profundidad).
 *
 * `apiAccessGuard` ya cierra toda `/api/*`, pero cada router vuelve a exigir la
 * sesión que necesita: un cambio futuro en el guard no puede convertirse por sí
 * solo en un IDOR.
 */
import type { Request, RequestHandler } from 'express'
import type { SessionPayload } from '@vox/shared'
import { isGuestUser } from '../lib/guests.ts'
import { HttpError } from '../utils/http-error.ts'

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.session) return next(new HttpError(401, 'Unauthorized'))
  next()
}

/** Exige una cuenta real: las secciones sociales no se abren a invitados. */
export const requireAccount: RequestHandler = async (req, _res, next) => {
  if (!req.session) return next(new HttpError(401, 'Unauthorized'))

  if (await isGuestUser(req.session.userId)) {
    return next(new HttpError(403, 'Crea una cuenta para acceder a esta sección', 'account_required'))
  }
  next()
}

export const requireTeacher: RequestHandler = (req, _res, next) => {
  if (!req.session) return next(new HttpError(401, 'Unauthorized'))
  if (req.session.role !== 'teacher') return next(new HttpError(403, 'Forbidden'))
  next()
}

/**
 * Sesión garantizada por `requireAuth` / `requireTeacher`.
 *
 * Si `req.session` no existe aquí es un error de programación (la ruta se
 * registró sin guard), no una petición no autorizada.
 */
export function sessionOf(req: Request): SessionPayload {
  if (!req.session) throw new HttpError(500, 'Error interno')
  return req.session
}
