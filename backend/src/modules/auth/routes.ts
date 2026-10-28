/**
 * Rutas HTTP de autenticación (montadas en `/api/auth`).
 *
 * Aquí sólo hay concerns de HTTP: parsear y validar el body, decidir el status
 * y emitir/limpiar la cookie. La lógica de dominio vive en `service.ts`.
 */
import { Router } from 'express'
import type { CefrLevel } from '@vox/shared'
import {
  SESSION_COOKIE_NAME,
  clearCookieOptions,
  createToken,
  sessionCookieOptions,
} from '../../lib/auth.ts'
import { requireAuth, sessionOf } from '../../middleware/require-auth.ts'
import { HttpError } from '../../utils/http-error.ts'
import {
  createGuestUser,
  findPublicUserById,
  signupAccount,
  updateFullName,
  verifyCredentials,
} from './service.ts'

const VALID_CEFR: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1']

export const authRouter = Router()

/** Límite simple por IP para que crear invitados no sea una vía de abuso. */
const guestCreations = new Map<string, number[]>()
const GUEST_CREATIONS_PER_HOUR = 20
const HOUR_MS = 60 * 60 * 1000

function allowGuestCreation(ip: string): boolean {
  const now = Date.now()
  const recent = (guestCreations.get(ip) ?? []).filter(at => now - at < HOUR_MS)
  if (recent.length >= GUEST_CREATIONS_PER_HOUR) return false
  recent.push(now)
  guestCreations.set(ip, recent)
  return true
}

/** Entrar sin cuenta: sesión de prueba para mirar el sistema y jugar 2 misiones. */
authRouter.post('/guest', async (req, res) => {
  // Idempotente: si ya hay sesión (invitado o alumno) no se crea otra cuenta.
  if (req.session) {
    const existing = await findPublicUserById(req.session.userId)
    if (existing) {
      res.json({ user: existing })
      return
    }
  }

  if (!allowGuestCreation(req.ip ?? 'unknown')) {
    throw new HttpError(429, 'Demasiadas cuentas de prueba. Inténtalo más tarde o crea una cuenta.')
  }

  const user = await createGuestUser()
  const token = await createToken({ userId: user.id, email: user.email, role: user.role })
  res
    .status(201)
    .cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions())
    .json({ user })
})

authRouter.post('/signup', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''
  const role = body.role

  if (!email || !password || !fullName || !role) {
    throw new HttpError(400, 'Todos los campos son requeridos')
  }
  if (password.length < 8) {
    throw new HttpError(400, 'La contraseña debe tener mínimo 8 caracteres')
  }
  // El rol y el nivel CEFR llegan del cliente: se validan aquí para que no se
  // persistan valores arbitrarios en la base de datos.
  if (role !== 'student' && role !== 'teacher') {
    throw new HttpError(400, 'Rol no válido')
  }

  const cefrLevel = body.cefr_level
  if (
    cefrLevel !== undefined &&
    cefrLevel !== null &&
    !VALID_CEFR.includes(cefrLevel as CefrLevel)
  ) {
    throw new HttpError(400, 'Nivel CEFR no válido')
  }

  const { user, converted } = await signupAccount(
    {
      email: email.toLowerCase(),
      password,
      full_name: fullName,
      role,
      cefr_level: (cefrLevel ?? null) as CefrLevel | null,
    },
    req.session?.userId,
  )

  const token = await createToken({ userId: user.id, email: user.email, role: user.role })
  res
    .status(201)
    .cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions())
    .json({ user, ...(converted ? { converted_guest: true } : {}) })
})

authRouter.post('/login', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>

  const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !password) {
    throw new HttpError(400, 'Email y contraseña requeridos')
  }

  const user = await verifyCredentials(email, password)
  if (!user) {
    throw new HttpError(401, 'Email o contraseña incorrectos')
  }

  const token = await createToken({ userId: user.id, email: user.email, role: user.role })
  res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions()).json({ user })
})

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, clearCookieOptions()).json({ ok: true })
})

authRouter.get('/me', requireAuth, async (req, res) => {
  const session = sessionOf(req)
  const user = await findPublicUserById(session.userId)

  if (!user) {
    throw new HttpError(404, 'User not found')
  }

  res.json({ user })
})

authRouter.patch('/update-profile', requireAuth, async (req, res) => {
  const session = sessionOf(req)
  const body = (req.body ?? {}) as Record<string, unknown>
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''

  if (!fullName) {
    throw new HttpError(400, 'Name is required')
  }

  const user = await updateFullName(session.userId, fullName)
  if (!user) {
    console.error('[auth] update-profile: usuario de la sesión no encontrado', session.userId)
    throw new HttpError(500, 'Failed to update profile')
  }

  res.json({ user })
})
