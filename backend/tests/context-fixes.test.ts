/**
 * Tests de las correcciones deterministas de verbo/colocación.
 *
 * El caso que originó la regla: una misión de cine y "see a movie" en vez de
 * "watch a movie". Debe llegar al informe y al historial aunque la IA no lo
 * detecte, y no duplicarse si ya viene corregido.
 */
import { describe, expect, it } from 'vitest'
import { addContextualVerbImprovements } from '../src/modules/missions/context-fixes.ts'

describe('correcciones de verbo por contexto', () => {
  it('cambia see → watch con películas y conserva el tiempo verbal', () => {
    const [fix] = addContextualVerbImprovements([], 'I see the new action movie on Saturday.')
    expect(fix).toMatchObject({
      original: 'see the new action movie',
      correction: 'watch the new action movie',
    })
    expect(fix?.explanation).toContain('watch')

    const [past] = addContextualVerbImprovements([], 'I saw a film yesterday.')
    expect(past).toMatchObject({ original: 'saw a film', correction: 'watched a film' })
  })

  it('corrige listen music y make/do a photo', () => {
    const listen = addContextualVerbImprovements([], 'I listen music every day.')
    expect(listen[0]).toMatchObject({ original: 'listen music', correction: 'listen to music' })

    const photo = addContextualVerbImprovements([], 'She made a photo of the city.')
    expect(photo[0]).toMatchObject({ original: 'made a photo', correction: 'took a photo' })
  })

  it('no toca las frases correctas ni duplica la mejora de la IA', () => {
    expect(addContextualVerbImprovements([], 'I watch a movie on Saturday.')).toEqual([])

    const existing = [{
      original: 'see a movie',
      correction: 'watch a movie',
      explanation: 'Se dice watch.',
    }]
    expect(addContextualVerbImprovements(existing, 'I see a movie.')).toEqual(existing)
  })

  it('no confunde el cine (edificio) con la película', () => {
    expect(addContextualVerbImprovements([], 'I see the movie theater on the corner.')).toEqual([])
  })
})
