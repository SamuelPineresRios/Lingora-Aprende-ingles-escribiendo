/**
 * Error con código HTTP explícito.
 *
 * El handler central de errores lo traduce a `{ error: mensaje }` con el
 * status indicado. Cualquier otro error se considera inesperado y responde 500
 * sin filtrar detalles internos.
 *
 * No usa parameter properties (`constructor(public readonly status: number)`)
 * porque `erasableSyntaxOnly` las prohíbe: Node ejecuta este TypeScript sin
 * transpilar y ese azúcar de TS no se puede borrar sin generar código.
 */
export class HttpError extends Error {
  readonly status: number
  /** Código estable para que el cliente distinga casos (p. ej. límite de invitado). */
  readonly code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}
