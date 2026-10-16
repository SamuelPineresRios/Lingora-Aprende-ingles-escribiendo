/**
 * Código de amigo: seis caracteres sin ambigüedad (sin 0/O ni 1/I).
 *
 * Se comparte de viva voz o por chat, así que se evitan letras que se
 * confunden al dictarlas. La unicidad la garantiza el índice de la tabla;
 * quien inserta reintenta si el código ya estaba pillado.
 */
import { randomInt } from 'node:crypto'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const FRIEND_CODE_LENGTH = 6

export function generateFriendCode(): string {
  let code = ''
  for (let index = 0; index < FRIEND_CODE_LENGTH; index++) {
    code += ALPHABET[randomInt(ALPHABET.length)]
  }
  return code
}

/** Normaliza lo que teclea el alumno: mayúsculas y sin espacios ni guiones. */
export function normalizeFriendCode(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]/g, '')
}
