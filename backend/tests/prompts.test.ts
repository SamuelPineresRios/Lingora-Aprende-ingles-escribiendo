/**
 * Tests del prompt del rol por subnivel y nivel.
 *
 * Lo importante: que cada tier reciba su exigencia de forma, que la severidad
 * de los errores dependa del CEFR (A1 indulgente, B2/C1 estrictos) y que el
 * esquema pida el campo `confused` que pinta la cara de confusión.
 */
import { describe, expect, it } from 'vitest'
import { buildHintsPrompt, buildRoleplaySystemPrompt, HINTS_SCHEMA, ROLEPLAY_OPENING_SCHEMA, ROLEPLAY_TURN_SCHEMA } from '../src/modules/chat/prompts.ts'
import { buildEvaluationPrompt, SYSTEM_PROMPT_BASE } from '../src/modules/missions/prompts.ts'
import { EVALUATION_SCHEMA } from '../src/modules/missions/prompts.ts'

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

  it('el tier 3 pide dos frases y aplica la severidad del nivel', () => {
    const prompt = buildRoleplaySystemPrompt({ mission: { ...mission, tier: 3 }, userLevel: 'A1' })

    expect(prompt).toContain('tier 3')
    expect(prompt).toContain('two sentences')
    expect(prompt).toContain('ERROR STRICTNESS - A1 (BE LENIENT)')
  })

  it('el tier 1 corrige sin bloquear el avance', () => {
    const prompt = buildRoleplaySystemPrompt({ mission: { ...mission, tier: 1 }, userLevel: 'A1' })

    expect(prompt).toContain('tier 1')
    expect(prompt).toContain('MAY rate 3-4')
  })

  it('sin tier no añade exigencia de subnivel', () => {
    const prompt = buildRoleplaySystemPrompt({ mission, userLevel: 'A1' })

    expect(prompt).not.toContain('This mission is tier')
  })

  it('la severidad de los errores sube con el nivel', () => {
    const a1 = buildRoleplaySystemPrompt({ mission, userLevel: 'A1' })
    const a2 = buildRoleplaySystemPrompt({ mission, userLevel: 'A2' })
    const b2 = buildRoleplaySystemPrompt({ mission, userLevel: 'B2' })
    const c1 = buildRoleplaySystemPrompt({ mission, userLevel: 'C1' })

    expect(a1).toContain('ERROR STRICTNESS - A1 (BE LENIENT)')
    expect(a1).toContain('Do NOT block for missing articles')
    expect(a1).toContain('Block ONLY when the message is unintelligible')
    expect(a2).toContain('ERROR STRICTNESS - A2')
    expect(a2).not.toContain('BE LENIENT')
    expect(b2).toContain('ERROR STRICTNESS - B2 (STRICTER)')
    expect(b2).toContain('collocations')
    expect(c1).toContain('ERROR STRICTNESS - C1 (VERY STRICT)')
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

  it('el evaluador revisa verbos y colocaciones según la escena', () => {
    const prompt = `${SYSTEM_PROMPT_BASE}
${buildEvaluationPrompt({
  cefrLevel: 'A1',
  objective: 'Elige una película para ver esta noche.',
  sceneContext: 'Un cine un sábado por la tarde.',
  feedbackLanguage: 'es',
  responseText: 'I see a movie with my friends.',
})}`

    expect(prompt).toContain('CONTEXTUAL VERB')
    expect(prompt).toContain('see a movie')
    expect(prompt).toContain('watch a movie')
    expect(prompt).toContain('improvements')
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

    const properties = HINTS_SCHEMA.properties as Record<string, { type?: string }>
    expect(properties.hints?.type).toBe('array')
  })

  it('los esquemas no llevan minItems/maxItems (Anthropic sólo admite 0 o 1)', () => {
    expect(JSON.stringify(HINTS_SCHEMA)).not.toContain('minItems')
    expect(JSON.stringify(HINTS_SCHEMA)).not.toContain('maxItems')
    expect(JSON.stringify(EVALUATION_SCHEMA)).not.toContain('minItems')
    expect(JSON.stringify(EVALUATION_SCHEMA)).not.toContain('maxItems')
  })
})
