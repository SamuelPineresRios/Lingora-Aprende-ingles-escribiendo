/**
 * Rutas de la aplicación y su nivel de acceso.
 *
 * Fuente única de verdad para el middleware del backend (API) y los guards
 * del frontend (páginas). El emparejamiento es por prefijo, con las mismas
 * cadenas que usaba `middleware.ts` para no alterar la autorización.
 *
 * `/group/` lleva barra final a propósito: cubre `/group/create` o `/group/123`
 * sin capturar `/groups`, que es una ruta de estudiante.
 */

/** Accesibles sin sesión. */
export const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/api/auth/login',
  '/api/auth/signup',
] as const

/** Exclusivas del rol `teacher` (páginas y API). */
export const TEACHER_PATHS = [
  '/dashboard',
  '/group/',
  '/api/teachers',
] as const

/** Exclusivas del rol `student` (sólo páginas; su API se valida por recurso). */
export const STUDENT_PATHS = [
  '/missions',
  '/mission/',
  '/feedback',
  '/session-summary',
  '/join-group',
  '/groups',
  '/profile',
  '/words',
  '/ranking',
  '/season',
  '/store',
  '/avatar',
] as const

function matchesAnyPath(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some(prefix => path.startsWith(prefix))
}

export const isPublicPath = (path: string): boolean => matchesAnyPath(path, PUBLIC_PATHS)
export const isTeacherPath = (path: string): boolean => matchesAnyPath(path, TEACHER_PATHS)
export const isStudentPath = (path: string): boolean => matchesAnyPath(path, STUDENT_PATHS)

/** Rutas con sesión obligatoria (páginas de alumno o profesor, y toda la API). */
export const isProtectedPath = (path: string): boolean =>
  path.startsWith('/api/') || isTeacherPath(path) || isStudentPath(path)
