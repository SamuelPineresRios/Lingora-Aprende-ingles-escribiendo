import { describe, expect, it } from 'vitest'
import { checkRewrite } from './rewrite.ts'

const correction = {
  original:
    'I change the users component in src/components/Users.jsx, and I also update the API service file.',
  corrected:
    'I changed the users component in src/components/Users.jsx, and I also updated the API service file.',
}

describe('reescritura flexible', () => {
  it('acepta reformulaciones equivalentes y no obliga a copiar literalmente', () => {
    const equivalents = [
      correction.corrected,
      'i changed the users component in src/components/Users.jsx and i updated the api service file',
      "I've changed the users component in src/components/Users.jsx, and I also updated the API service file.",
      'I modified the users component in src/components/Users.jsx, and I also updated the API service file.',
      "I changed the user's component in src/components/Users.jsx, and I also updated the API service file.",
    ]

    for (const input of equivalents) {
      const result = checkRewrite(input, correction)
      expect(result.accepted, input).toBe(true)
      expect(result.similarity).toBeGreaterThanOrEqual(0.8)
    }
  })

  it('rechaza repetir el error original o cambiar el significado', () => {
    expect(checkRewrite(correction.original, correction).accepted).toBe(false)
    expect(checkRewrite('I updated the API service file.', correction).accepted).toBe(false)
    expect(checkRewrite('I did not change anything in the component.', correction).accepted).toBe(false)
  })

  it('señala las palabras de la corrección que faltan', () => {
    const result = checkRewrite(
      'I changed the users component in src/components/Users.jsx and I updated the API service file.',
      correction,
    )
    expect(result.missing).toContain('also')
  })
})
