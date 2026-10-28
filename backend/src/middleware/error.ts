/**
 * Handler central de errores.
 *
 * Los errores esperados viajan como `HttpError` y se traducen a
 * `{ error: mensaje }` con su status. Todo lo demás es un error inesperado:
 * se registra completo en el servidor y se responde 500 genérico para no
 * filtrar detalles internos (nombres de tabla, SQL, rutas de fichero...).
 */
import type { ErrorRequestHandler, RequestHandler } from 'express'
import { HttpError } from '../utils/http-error.ts'

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found' })
}

interface BodyParserError {
  type?: string
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...(err.code ? { code: err.code } : {}) })
    return
  }

  // express.json() marca los cuerpos malformados con este `type`.
  if (err && typeof err === 'object' && (err as BodyParserError).type === 'entity.parse.failed') {
    res.status(400).json({ error: 'JSON inválido' })
    return
  }

  console.error('[api] error no controlado:', err)
  res.status(500).json({ error: 'Error interno' })
}
