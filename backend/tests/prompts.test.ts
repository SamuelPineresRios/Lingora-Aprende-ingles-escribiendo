/**
 * Tests del prompt del rol por subnivel.
 *
 * Lo importante: que cada tier reciba su exigencia, que el bloque estricto de
 * gramática esté presente (bloquea en 2 y 3, no en 1) y que el esquema pida
 * el campo `confused` que pinta la cara de confusión.
 */
import { describe, expect, it } from 'vitest'
import { buildHintsPrompt, buildRoleplaySystemPrompt, HINTS_SCHEMA, ROLEPLAY_OPENING_SCHEMA, ROLEPLAY_TURN_SCHEMA } from '../src/modules/chat/prompts.ts'

const mission = {
  character_name: 'Barista',
  objective: 'Pide un café y pregunta el precio.',
  scene_context: 'Una cafetería por la mañana.',
}

describe('prompt del rol por tier', () => {
  it('lleva el bloque estricto de gramática en todos los niveles', () => {
    const prompt = buildRoleplaySystemPrompt({ mission: { ...mission, tier: 2 }, userLevel: 'A1' })

    expect(prompt).toContain('GRAMMAR FIRST')
    expect(prompt).toContain('third-person -s')
    expect(prompt).toContain('Verb before subject')
    expect(prompt).toContain('does NOT move')
  })

  it('el tier 3 añade tiempos y preposiciones y pide dos frases', () => {
    const prompt = buildRoleplaySystemPrompt({ mission: { ...mission, tier: 3 }, userLevel: 'A1' })

    expect(prompt).toContain('tier 3')
    expect(prompt).toContain('simple past')
    expect(prompt).toContain('two sentences')
  })

  it('el tier 1 corrige sin bloquear el avance', () => {
    const prompt = buildRoleplaySystemPrompt({ mission: { ...mission, tier: 1 }, userLevel: 'A1' })

    expect(prompt).toContain('tier 1')
    expect(prompt).toContain('MAY rate 3-4')
  })

  it('sin tier no añade exigencia de subnivel', () => {
    const prompt = buildRoleplaySystemPrompt({ mission, userLevel: 'A1' })

    expect(prompt).not.toContain('This mission is A1 tier')
  })

  it('no inventa errores de -s fuera de la tercera persona', () => {
    const prompt = buildRoleplaySystemPrompt({ mission: { ...mission, tier: 2 }, userLevel: 'B1' })

    expect(prompt).toContain('NEVER INVENT AN ERROR')
    expect(prompt).toContain('Third-person -s exists ONLY with he/she/it')
    expect(prompt).toContain('"I am not sleeping"')
  })

  it('el esquema del turno exige `confused`', () => {
    const properties = ROLEPLAY_TURN_SCHEMA.properties as Record<string, { type?: string }>
    expect(ROLEPLAY_TURN_SCHEMA.required).toContain('confused')
    expect(properties.confused?.type).toBe('boolean')
  })

  it('ambos esquemas exigen la traducción del mensaje', () => {
    const openingProperties = ROLEPLAY_OPENING_SCHEMA.properties as Record<string, { type?: string }>
    const turnProperties = ROLEPLAY_TURN_SCHEMA.properties as Record<string, { type?: string }>

    expect(ROLEPLAY_OPENING_SCHEMA.required).toContain('message_translation')
    expect(ROLEPLAY_TURN_SCHEMA.required).toContain('message_translation')
    expect(openingProperties.message_translation?.type).toBe('string')
    expect(turnProperties.message_translation?.type).toBe('string')
  })
})

describe('pistas de ayuda', () => {
  it('pide exactamente dos respuestas posibles', () => {
    const prompt = buildHintsPrompt({
      lastMessage: 'What would you like to drink?',
      mission: { character_name: 'Barista', objective: 'Pide un café', scene_context: 'Una cafetería' },
      userLevel: 'A1',
    })
    expect(prompt).toContain('EXACTLY TWO')

    const properties = HINTS_SCHEMA.properties as Record<string, { minItems?: number; maxItems?: number }>
    expect(properties.hints?.minItems).toBe(2)
    expect(properties.hints?.maxItems).toBe(2)
  })
})
