/**
 * Evaluación de la respuesta escrita de una misión.
 *
 * Envuelve la llamada al LLM y normaliza el resultado: la columna de la BD es
 * `integer` y `judgment` es un valor cerrado, así que una respuesta del modelo
 * fuera de formato se degrada a la evaluación técnica de respaldo en lugar de
 * reventar el INSERT.
 */
import { completeChat } from '../../lib/ai.ts'
import {
  EVALUATION_SCHEMA,
  SYSTEM_PROMPT_BASE,
  buildEvaluationPrompt,
  type EvaluationPromptContext,
} from './prompts.ts'

import type { EvaluationImprovement } from '../../db/schema.ts'

export interface EvaluationResult {
  comprehensibility_score: number
  grammar_score: number
  lexical_richness_score: number
  judgment: 'ADVANCE' | 'PAUSE'
  feedback_text: string
  detected_structures: string[]
  /** Mejoras concretas: frase original, corrección y explicación. */
  improvements: EvaluationImprovement[]
}

/** Evaluación fija para respuestas no serias ("haha", "test", ...). */
export const NON_GENUINE_EVALUATION: EvaluationResult = {
  comprehensibility_score: 15,
  grammar_score: 10,
  lexical_richness_score: 5,
  judgment: 'PAUSE',
  feedback_text:
    'Tu respuesta debe ser seria y tener sentido. Escribe una respuesta completa que responda a la pregunta.',
  detected_structures: [],
  improvements: [],
}

/** Respaldo cuando el proveedor de IA falla o responde con un formato inválido. */
const TECHNICAL_FALLBACK_EVALUATION: EvaluationResult = {
  comprehensibility_score: 65,
  grammar_score: 60,
  lexical_richness_score: 55,
  judgment: 'PAUSE',
  feedback_text:
    'Recibimos tu mensaje, pero hubo un problema técnico al evaluarlo. ¡Tu respuesta fue guardada! Intenta de nuevo para continuar la historia.',
  detected_structures: [],
  improvements: [],
}

/** Descarta respuestas demasiado cortas, repetitivas o sin letras. */
export function isGenuineResponse(text: string): boolean {
  const normalized = text.trim().toLowerCase()

  if (normalized.length < 3) return false
  if (normalized.split(/\s+/).length < 2) return false

  const nonsensePatterns = [
    /^(haha|hehe|lol|test|aaa+|bbb+|ccc+|zzz+|xxx+|123+|456+|789+|000+)$/,
    /^(hi+|bye+|ok+|yes+|no+)$/,
    /^(.)\1{4,}$/,
  ]

  for (const pattern of nonsensePatterns) {
    if (pattern.test(normalized)) return false
  }

  return /[a-zA-Z]/.test(text)
}

function clampScore(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  return Math.min(100, Math.max(0, Math.round(n)))
}

function parseStructures(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

/** Valida las mejoras estructuradas; cualquier forma rara se descarta entera. */
function parseImprovements(value: unknown): EvaluationImprovement[] {
  if (!Array.isArray(value)) return []
  const items: EvaluationImprovement[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const item = entry as Record<string, unknown>
    if (typeof item.original !== 'string' || typeof item.correction !== 'string' || typeof item.explanation !== 'string') continue
    const correction = item.correction.trim()
    const explanation = item.explanation.trim()
    if (!correction || !explanation) continue
    items.push({ original: item.original.trim(), correction, explanation })
  }
  return items.slice(0, 4)
}

/** Devuelve la evaluación validada, o null si el modelo no respetó el formato. */
function parseEvaluation(content: string): EvaluationResult | null {
  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    return null
  }

  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>

  const comprehensibility = clampScore(data.comprehensibility_score)
  const grammar = clampScore(data.grammar_score)
  const lexical = clampScore(data.lexical_richness_score)
  const judgment = data.judgment
  const feedback = data.feedback_text

  if (comprehensibility === null || grammar === null || lexical === null) return null
  if (judgment !== 'ADVANCE' && judgment !== 'PAUSE') return null
  if (typeof feedback !== 'string' || feedback.trim() === '') return null

  return {
    comprehensibility_score: comprehensibility,
    grammar_score: grammar,
    lexical_richness_score: lexical,
    judgment,
    feedback_text: feedback,
    detected_structures: parseStructures(data.detected_structures),
    improvements: parseImprovements(data.improvements),
  }
}

/** Nunca lanza: ante cualquier fallo devuelve la evaluación de respaldo. */
export async function evaluateResponse(
  context: EvaluationPromptContext,
): Promise<EvaluationResult> {
  try {
    const startedAt = Date.now()

    const content = await completeChat({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_BASE },
        { role: 'user', content: buildEvaluationPrompt(context) },
      ],
      schema: EVALUATION_SCHEMA,
    })

    const parsed = parseEvaluation(content)
    if (!parsed) {
      console.error('[Eval] El modelo devolvió un formato inválido')
      return { ...TECHNICAL_FALLBACK_EVALUATION }
    }

    console.log(
      `[Eval] ${Date.now() - startedAt}ms judgment=${parsed.judgment} score=${parsed.comprehensibility_score}`,
    )
    return parsed
  } catch (err) {
    console.error('[Eval] Fallback:', err)
    return { ...TECHNICAL_FALLBACK_EVALUATION }
  }
}
