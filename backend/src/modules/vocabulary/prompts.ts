/**
 * Prompt y esquema del vocabulario clave de una misión.
 *
 * Parte de la escena narrativa que el alumno acaba de leer y de los datos de la
 * misión: las 5 palabras deben prepararle para la conversación, no ser una
 * lista suelta.
 */
import type { CefrLevel } from '@vox/shared'
import type { JsonSchema } from '../../lib/ai.ts'
import type { IntroductionSource } from '../introductions/prompts.ts'

/** Misma fuente que la escena: la misión manda. */
export type VocabularySource = IntroductionSource

/**
 * Dificultad del vocabulario por nivel, en inglés para el modelo.
 *
 * A1/A2 se quedan en lo cotidiano; de B1 en adelante entran phrasal verbs,
 * expresiones y matices, siempre dentro de la situación de la misión.
 */
const CEFR_VOCABULARY_GUIDANCE: Record<CefrLevel, string> = {
  A1: 'Everyday, very basic words (food, family, places, frequent verbs). Direct, unambiguous translations.',
  A2: 'Slightly broader everyday vocabulary: common verbs, places, objects and simple expressions.',
  B1: 'Contextual vocabulary: more specific verbs, common conversational expressions and simple phrasal verbs when they fit.',
  B2: 'Specific vocabulary and natural expressions, relevant phrasal verbs and nuances of meaning when useful.',
  C1: 'Advanced contextual vocabulary, collocations, situation-specific terminology and fine nuances.',
}

/** Escena ya guardada que se le pasa al modelo como contexto. */
export interface VocabularyScene {
  title: string
  description: string
  /** Cada línea con quién la dice: las del alumno son las que tendrá que producir. */
  lines: Array<{ speaker: 'student' | 'ai'; text: string; translation: string }>
  expressions: string[]
}

export const VOCABULARY_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    words: {
      type: 'array',
      description: 'Exactamente 5 palabras clave, en el orden en que conviene estudiarlas.',
      items: {
        type: 'object',
        properties: {
          word: {
            type: 'string',
            description: 'Palabra clave en inglés, en minúsculas.',
          },
          translation: {
            type: 'string',
            description: 'Traducción correcta al español.',
          },
          example: {
            type: 'string',
            description: 'Frase de ejemplo en inglés que usa la palabra en una situación como la de la misión.',
          },
          example_translation: {
            type: 'string',
            description: 'Traducción al español de la frase de ejemplo.',
          },
        },
        required: ['word', 'translation', 'example', 'example_translation'],
        additionalProperties: false,
      },
    },
  },
  required: ['words'],
  additionalProperties: false,
}

/** Prompt de generación del vocabulario clave. */
export function buildVocabularyPrompt(source: VocabularySource, scene: VocabularyScene | null): string {
  const sceneBlock = scene
    ? `SCENE THE STUDENT JUST SAW
Title: ${scene.title}
Summary: ${scene.description}
Dialogue (S = lines the STUDENT will have to produce; C = lines of the character):
${scene.lines.map(line => `- ${line.speaker === 'student' ? 'S' : 'C'}: ${line.text}`).join('\n')}
Useful expressions: ${scene.expressions.join(' | ')}`
    : 'SCENE: (the narrative scene has not been generated yet; base the words on the mission data)'

  return `You are an English teacher preparing a Spanish-speaking student for a roleplay mission.

MISSION
Level: ${source.cefrLevel}
Title: ${source.title}
Objective: ${source.objective ?? '(no objective)'}
Situation: ${source.sceneContext ?? source.description ?? '(no description)'}
Character the student will talk to: ${source.characterName ?? '(unknown)'}
Expected outcome: ${source.expectedOutcome ?? '(not specified)'}
Example conversation: ${source.exampleConversation ?? '(none)'}

${sceneBlock}

Choose EXACTLY 5 key English words the student needs to understand this scene and succeed in the mission.

Rules:
- EXACTLY 5 words. Never 4, 6, 7 or 10.
- Every word must appear in the scene or be directly tied to the expressions and the task the student must perform.
- PRIORITISE what the STUDENT has to say: the words and chunks they will need to produce their own lines (the "S" lines above) and to reach the objective. The character's words only matter if the student must understand or answer them. This is production practice, not a glossary of the scene.
- No generic filler (person, thing, good, day) unless it is genuinely essential to the mission.
- Difficulty for level ${source.cefrLevel}: ${CEFR_VOCABULARY_GUIDANCE[source.cefrLevel]}
- The words must anticipate what the student will need when speaking to ${source.characterName ?? 'the character'}, not be a random vocabulary list.
- Lowercase the English word. Single words only; short phrasal verbs are allowed from B1 up. No proper nouns or place names (cities, brands, people).
- No two words may share the same Spanish meaning: each of the 5 must teach something different.
- For each word: the Spanish translation, one example sentence in English that the student could plausibly say in this mission (6-14 words, level-appropriate), and its Spanish translation.
- The example sentence MUST contain the word exactly as written (same form), so it can be highlighted inside the sentence.

Answer with JSON only.`
}
