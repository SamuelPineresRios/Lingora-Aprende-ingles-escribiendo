/**
 * Prompts de la evaluación de escritura.
 *
 * Viven aparte del servicio porque son material pedagógico que cambia con
 * frecuencia y no deben mezclarse con la orquestación ni con el acceso a datos.
 */
import type { CefrLevel } from '@vox/shared'
import type { JsonSchema } from '../../lib/ai.ts'

/**
 * Esquema que debe cumplir la evaluación.
 *
 * Se envía como salida estructurada: el proveedor garantiza un JSON válido con
 * estas claves, así que no depende de que el prompt se obedezca.
 */
export const EVALUATION_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    comprehensibility_score: {
      type: 'integer',
      description: '0-100. Qué tan bien responde la respuesta al objetivo de la misión.',
    },
    grammar_score: { type: 'integer', description: '0-100.' },
    lexical_richness_score: { type: 'integer', description: '0-100.' },
    judgment: {
      type: 'string',
      enum: ['ADVANCE', 'PAUSE'],
      description: 'ADVANCE si el alumno avanza; PAUSE si debe reintentar.',
    },
    feedback_text: {
      type: 'string',
      description:
        'Retroalimentación en el idioma indicado: tres partes separadas por una línea en blanco (resultado, acierto y mejoras). Las mejoras van una por línea, cada una empezando por "- ".',
    },
    detected_structures: {
      type: 'array',
      items: { type: 'string' },
      description: 'Estructuras gramaticales detectadas, p. ej. "present-simple".',
    },
    improvements: {
      type: 'array',
      minItems: 1,
      maxItems: 4,
      items: {
        type: 'object',
        properties: {
          original: {
            type: 'string',
            description: 'Fragmento exacto de la respuesta del alumno que falla (o "" si es una mejora opcional).',
          },
          correction: { type: 'string', description: 'Versión correcta o mejora concreta, en inglés.' },
          explanation: { type: 'string', description: 'Por qué, breve y en español (máximo 20 palabras).' },
        },
        required: ['original', 'correction', 'explanation'],
        additionalProperties: false,
      },
      description: '2-4 mejoras concretas de la respuesta, estructuradas para el historial del alumno.',
    },
  },
  required: [
    'comprehensibility_score',
    'grammar_score',
    'lexical_richness_score',
    'judgment',
    'feedback_text',
    'detected_structures',
    'improvements',
  ],
  additionalProperties: false,
}

export const SYSTEM_PROMPT_BASE = `You are an expert English language evaluator for Latin American Spanish-speaking students learning English.
Your job: evaluate a student's written English response in a communicative mission context and provide CONSTRUCTIVE feedback.

🚫 VALIDATION RULES (REJECT IMMEDIATELY):
- Response is too short (< 5 words/characters in English): REJECT with comprehensibility_score = 10, judgment = "PAUSE"
- Response is nonsense/gibberish (HAHA, test, aaaaaa, etc): REJECT with comprehensibility_score = 15, judgment = "PAUSE"
- Response does NOT answer the objective/question asked: REJECT with comprehensibility_score = 20, judgment = "PAUSE"
- Response is in the WRONG LANGUAGE (not English): REJECT with comprehensibility_score = 5, judgment = "PAUSE"

CRITICAL SCORING RULES:
1. FIRST check: Does the response attempt to answer the objective? YES = continue evaluating, NO = automatic PAUSE
2. Evaluate COMMUNICATIVE EFFECTIVENESS above all — not grammatical perfection
3. Feedback must sound like a native Spanish-speaking English teacher
4. Return ONLY valid JSON — no markdown, no explanation, no preamble
5. feedback_text MUST follow this exact 3-part structure (separated by \\n\\n):
   PART 1 (2 sentences max): Narrative result — did the character understand the student? State clearly whether the objective was achieved.
   PART 2 (2 sentences max): One thing the student did correctly.
   PART 3 (2 to 4 SHORT lines, one per line, each starting with "- "): WHAT THEY MUST FIX — cada línea señala un problema concreto (cita la frase del alumno que falla y su versión correcta) o una mejora. Nunca un párrafo corrido: una idea por línea. Si todo está bien, una sola línea con una forma concreta de subir de nivel.
6. Además, rellena el campo improvements con 2-4 objetos { original, correction, explanation }: original es el fragmento exacto que falla (vacío si es una mejora opcional), correction la versión correcta en inglés y explanation el porqué en español (máximo 20 palabras). Deben coincidir con las líneas de la PART 3.

SCORING GUIDELINES:
- Minimum score for ANY valid attempt: 50 (must answer the question meaningfully)
- Score based on UNDERSTANDING and COMMUNICATIVE INTENT first, grammar second
- A1/A2: Accept basic but correct responses. Core meaning is key.
- B1: Accept mostly correct with minor errors
- B2: Accept well-formed responses with natural flow

JUDGMENT CALCULATION (AUTOMATIC):
1. Validate content quality first (reject if nonsense/off-topic)
2. Calculate comprehensibility_score (0-100) based on how well the message answers the objective
3. Apply this logic:
   - A1: judgment = "ADVANCE" if comprehensibility_score >= 55, else "PAUSE"
   - A2: judgment = "ADVANCE" if comprehensibility_score >= 65, else "PAUSE"
   - B1: judgment = "ADVANCE" if comprehensibility_score >= 75, else "PAUSE"
   - B2: judgment = "ADVANCE" if comprehensibility_score >= 80, else "PAUSE"

KEY: Valid answer to objective = minimum comprehensibility_score of 55+. Invalid/gibberish = comprehensibility_score < 30.

RETURN ONLY THIS JSON STRUCTURE:
{
  "comprehensibility_score": <integer 0-100>,
  "grammar_score": <integer 0-100>,
  "lexical_richness_score": <integer 0-100>,
  "judgment": "ADVANCE" or "PAUSE",
  "feedback_text": "<string>",
  "detected_structures": ["<string>"]
}`

const CEFR_EVALUATION_CRITERIA: Record<CefrLevel, string> = {
  A1: 'Accept basic responses with simple structures. Focus: Can you understand the core meaning? Grammar perfection is NOT required.',
  A2: 'Accept mostly correct responses with minor errors. Focus: Is the message clear? Minor grammar errors are OK.',
  B1: 'Accept well-formed responses with natural flow. Minor errors acceptable if meaning is clear.',
  B2: 'Expect more sophisticated language. Minor errors still acceptable if communication is successful.',
  C1: 'Expect fluent, precise, near-native language: varied structures, accurate register and nuanced ideas. Only occasional slips are acceptable.',
}

export interface EvaluationPromptContext {
  cefrLevel: CefrLevel
  objective: string | null
  sceneContext: string | null
  /** Idioma de la retroalimentación (`users.language_preference`). */
  feedbackLanguage: string
  responseText: string
}

export function buildEvaluationPrompt({
  cefrLevel,
  objective,
  sceneContext,
  feedbackLanguage,
  responseText,
}: EvaluationPromptContext): string {
  const criteria = CEFR_EVALUATION_CRITERIA[cefrLevel] ?? CEFR_EVALUATION_CRITERIA.B1

  return `EVALUATION TASK - ${cefrLevel} Level Student

Student Profile:
- CEFR Level: ${cefrLevel}
- Evaluation Criteria: ${criteria}

Mission Details:
- Objective: ${objective}
- Scene: ${sceneContext}
- Feedback Language: ${feedbackLanguage} (Spanish)

Student's Response to Evaluate:
"""${responseText}"""

EVALUATION INSTRUCTIONS (STRICT):
1. Read the response carefully
2. Does it answer the OBJECTIVE/QUESTION asked? 
   - YES → Evaluate quality (65-100 comprehensibility)
   - NO → Reject with PAUSE judgment (20-40 comprehensibility)
3. Quality Scoring:
   - If YES answer: comprehensibility_score 65-100 → judgment = "ADVANCE"
   - If NO/unclear answer: comprehensibility_score 10-60 → judgment = "PAUSE"
4. grammar_score and lexical_richness_score are secondary
5. For feedback_text - be encouraging but honest about whether they answered the question

Critical: A response must ACTUALLY ANSWER THE QUESTION to get a high score. If the response doesn't address the objective, judgment = "PAUSE".`
}
