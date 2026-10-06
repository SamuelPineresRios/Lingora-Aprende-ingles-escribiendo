/**
 * Tests del vocabulario clave de la misión.
 *
 * Lo esencial: que salgan SIEMPRE 5 palabras, que se genere una sola vez por
 * misión (la llamada al modelo es cara) y que las opciones sirvan para la
 * actividad (la correcta + 3 incorrectas verosímiles, sin repetidos).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/lib/ai.ts', () => {
  class AIProviderError extends Error {
    readonly status: number
    readonly detail: string | undefined
    constructor(message: string, status: number, detail?: string) {
      super(message)
      this.name = 'AIProviderError'
      this.status = status
      this.detail = detail
    }
  }
  return {
    DEFAULT_AI_MODEL: 'test-model',
    AIProviderError,
    requireAnthropicKey: vi.fn(() => 'test-key'),
    completeChat: vi.fn(),
  }
})

import request from 'supertest'
import { AIProviderError, completeChat } from '../src/lib/ai.ts'
import { createApp } from '../src/app.ts'
import { db } from '../src/db/client.ts'
import { mission_introductions } from '../src/db/schema.ts'
import { validateWords } from '../src/modules/vocabulary/service.ts'
import { resetDb } from './helpers/db.ts'
import { createMission, signupActor } from './helpers/fixtures.ts'

const app = createApp()
const mockedCompleteChat = vi.mocked(completeChat)

/** Respuesta válida con `count` palabras, como la devolvería el modelo. */
function vocabularyResponse(count = 5): string {
  return JSON.stringify({
    words: Array.from({ length: count }, (_, index) => ({
      word: `word${index}`,
      translation: `traducción ${index}`,
      example: `This is example sentence number ${index}.`,
      example_translation: `Esta es la frase de ejemplo número ${index}.`,
    })),
  })
}

/** Inserta una escena guardada para comprobar que alimenta el prompt. */
async function createScene(missionId: string): Promise<void> {
  await db.insert(mission_introductions).values({
    id: 'intro-vocab-test',
    mission_id: missionId,
    scene_title: 'Pidiendo direcciones',
    scene_description: 'Una calle del centro con un turista perdido.',
    characters: [
      { id: 'A', name: 'Street Guide', role: 'Guía local', emoji: '🧑', played_by: 'ai' },
      { id: 'B', name: 'Alex', role: 'Turista', emoji: '🧑', played_by: 'student' },
    ],
    lines: [
      { speaker: 'A', text: 'Turn right at the corner, please.', translation: 'Gira a la derecha en la esquina.' },
      { speaker: 'B', text: 'Thank you very much!', translation: '¡Muchas gracias!' },
      { speaker: 'A', text: 'The museum is on your left.', translation: 'El museo está a tu izquierda.' },
      { speaker: 'B', text: 'Is it far from here?', translation: '¿Está lejos de aquí?' },
    ],
    useful_expressions: ['Turn right', 'On your left', 'Is it far?'],
    generated_by: 'test',
  })
}

beforeEach(async () => {
  await resetDb()
  mockedCompleteChat.mockReset()
  mockedCompleteChat.mockResolvedValue(vocabularyResponse(5))
})

describe('GET /api/missions/:id/vocabulary', () => {
  it('responde 401 sin sesión', async () => {
    const res = await request(app).get('/api/missions/m-1/vocabulary')
    expect(res.status).toBe(401)
  })

  it('responde 404 si la misión no existe', async () => {
    const student = await signupActor(app, 'student')
    const res = await student.agent.get('/api/missions/no-existe/vocabulary')

    expect(res.status).toBe(404)
    expect(mockedCompleteChat).not.toHaveBeenCalled()
  })

  it('genera exactamente 5 palabras y las reutiliza para todos', async () => {
    const student = await signupActor(app, 'student')
    const otro = await signupActor(app, 'student')
    const missionId = await createMission({ cefr_level: 'A2' })

    const primera = await student.agent.get(`/api/missions/${missionId}/vocabulary`)
    expect(primera.status).toBe(200)
    expect(primera.body.vocabulary.words).toHaveLength(5)
    expect(mockedCompleteChat).toHaveBeenCalledTimes(1)

    // El segundo alumno no dispara otra generación.
    const segunda = await otro.agent.get(`/api/missions/${missionId}/vocabulary`)
    expect(segunda.status).toBe(200)
    expect(segunda.body.vocabulary.words).toHaveLength(5)
    expect(mockedCompleteChat).toHaveBeenCalledTimes(1)
  })

  it('cada palabra trae su ejemplo en inglés y su traducción', async () => {
    const student = await signupActor(app, 'student')
    const missionId = await createMission({ cefr_level: 'A1' })

    const res = await student.agent.get(`/api/missions/${missionId}/vocabulary`)

    for (const word of res.body.vocabulary.words) {
      expect(word.translation).toBeTruthy()
      expect(word.example).toContain('example sentence')
      expect(word.example_translation).toContain('frase de ejemplo')
      // La actividad ya no usa opciones ni distractores.
      expect(word.options).toBeUndefined()
      expect(word.distractors).toBeUndefined()
    }
  })

  it('recorta a 5 si el modelo devuelve de más', async () => {
    mockedCompleteChat.mockResolvedValue(vocabularyResponse(10))
    const student = await signupActor(app, 'student')
    const missionId = await createMission({ cefr_level: 'B1' })

    const res = await student.agent.get(`/api/missions/${missionId}/vocabulary`)

    expect(res.status).toBe(200)
    expect(res.body.vocabulary.words).toHaveLength(5)
    expect(mockedCompleteChat).toHaveBeenCalledTimes(1)
  })

  it('reintenta si el modelo trae menos de 5 y devuelve 502 si no lo logra', async () => {
    mockedCompleteChat.mockResolvedValue(vocabularyResponse(4))
    const student = await signupActor(app, 'student')
    const missionId = await createMission({ cefr_level: 'B2' })

    const res = await student.agent.get(`/api/missions/${missionId}/vocabulary`)

    expect(res.status).toBe(502)
    expect(mockedCompleteChat).toHaveBeenCalledTimes(2)
  })

  it('acepta el segundo intento cuando el primero traía menos palabras', async () => {
    mockedCompleteChat
      .mockResolvedValueOnce(vocabularyResponse(3))
      .mockResolvedValueOnce(vocabularyResponse(5))
    const student = await signupActor(app, 'student')
    const missionId = await createMission({ cefr_level: 'C1' })

    const res = await student.agent.get(`/api/missions/${missionId}/vocabulary`)

    expect(res.status).toBe(200)
    expect(res.body.vocabulary.words).toHaveLength(5)
    expect(mockedCompleteChat).toHaveBeenCalledTimes(2)
  })

  it('traduce el proveedor caído a 502, no a 500', async () => {
    mockedCompleteChat.mockRejectedValue(new AIProviderError('sin red', 502))
    const student = await signupActor(app, 'student')
    const missionId = await createMission({ cefr_level: 'A2' })

    const res = await student.agent.get(`/api/missions/${missionId}/vocabulary`)

    expect(res.status).toBe(502)
    expect(res.body).toEqual({ error: 'El proveedor de IA no respondió' })
  })

  it('usa la escena narrativa como contexto del prompt', async () => {
    const student = await signupActor(app, 'student')
    const missionId = await createMission({ cefr_level: 'A2' })
    await createScene(missionId)

    await student.agent.get(`/api/missions/${missionId}/vocabulary`)

    const prompt = mockedCompleteChat.mock.calls[0]?.[0]?.messages?.[0]?.content ?? ''
    expect(prompt).toContain('Pidiendo direcciones')
    expect(prompt).toContain('EXACTLY 5')
    // El diálogo llega anotado: S lo que dirá el alumno, C lo del personaje.
    expect(prompt).toContain('- S: Thank you very much!')
    expect(prompt).toContain('- C: Turn right at the corner, please.')
    // Y la regla de priorizar lo que el alumno tiene que producir.
    expect(prompt).toContain('PRIORITISE what the STUDENT has to say')
  })
})

describe('POST /api/missions/:id/vocabulary/regenerate', () => {
  it('solo los docentes pueden regenerarlo', async () => {
    const student = await signupActor(app, 'student')
    const missionId = await createMission({ cefr_level: 'B1' })

    const res = await student.agent.post(`/api/missions/${missionId}/vocabulary/regenerate`)
    expect(res.status).toBe(403)
  })

  it('el docente obtiene vocabulario nuevo y sube la versión', async () => {
    const teacher = await signupActor(app, 'teacher')
    const student = await signupActor(app, 'student')
    const missionId = await createMission({ cefr_level: 'B1' })

    const primera = await student.agent.get(`/api/missions/${missionId}/vocabulary`)
    expect(primera.body.vocabulary.version).toBe(1)

    const regenerada = await teacher.agent.post(`/api/missions/${missionId}/vocabulary/regenerate`)
    expect(regenerada.status).toBe(200)
    expect(regenerada.body.vocabulary.version).toBe(2)
  })
})

describe('validateWords', () => {
  const base = {
    translation: 'ayudar',
    example: 'Can you help me?',
    example_translation: '¿Puedes ayudarme?',
  }
  const fourMore = Array.from({ length: 4 }, (_, i) => ({
    word: `w${i}`,
    translation: `t${i}`,
    example: `Example ${i}.`,
    example_translation: `Ejemplo ${i}.`,
  }))

  it('exige los cuatro campos de cada palabra', () => {
    expect(validateWords({ words: [{ ...base, word: 'help' }] })).toBeNull() // una sola no llega a 5
    expect(
      validateWords({
        words: [{ word: 'help', translation: 'ayudar' }, ...fourMore],
      }),
    ).toBeNull() // sin ejemplo
    expect(
      validateWords({
        words: [{ ...base, word: 'help', example: '' }, ...fourMore],
      }),
    ).toBeNull() // ejemplo vacío
  })

  it('rechaza palabras o significados repetidos', () => {
    expect(
      validateWords({
        words: [{ ...base, word: 'help' }, { ...base, word: 'help' }, ...fourMore],
      }),
    ).toBeNull() // palabra repetida

    expect(
      validateWords({
        words: [{ ...base, word: 'help' }, { ...base, word: 'aid' }, ...fourMore],
      }),
    ).toBeNull() // "help" y "aid" enseñan lo mismo
  })

  it('devuelve exactamente 5 cuando son válidas y recorta las de más', () => {
    const words = Array.from({ length: 9 }, (_, i) => ({
      word: `word${i}`,
      translation: `t${i}`,
      example: `Example ${i}.`,
      example_translation: `Ejemplo ${i}.`,
    }))

    const valid = validateWords({ words })
    expect(valid).toHaveLength(5)
    expect(valid?.[0]?.word).toBe('word0')
    expect(valid?.[0]?.example_translation).toBe('Ejemplo 0.')
  })
})
