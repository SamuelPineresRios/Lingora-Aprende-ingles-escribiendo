/**
 * Correcciones de verbo y colocación según el contexto de la misión.
 *
 * El evaluador (IA) a veces acepta verbos gramaticalmente correctos pero poco
 * naturales en la escena ("see a movie" en vez de "watch a movie"). Esta capa
 * determinista garantiza que esas mejoras lleguen al informe y al historial de
 * errores aunque el modelo no las detecte.
 */
import type { EvaluationImprovement } from '../../db/schema.ts'

/** Zona del verbo + contexto que exige la corrección. */
interface ContextRule {
  pattern: RegExp
  /** Verbo base de la corrección (para no duplicar la mejora de la IA). */
  correctionStem: string
  build: (match: RegExpMatchArray) => { correction: string; explanation: string }
}

const MEDIA = String.raw`\b(movie|movies|film|films|show|shows|series|tv|television|match|matches|game|games)\b(?!\s*(?:theater|theatre|cinema|poster|trailer))`

const WATCH: Record<string, string> = {
  see: 'watch',
  saw: 'watched',
  seen: 'watched',
  seeing: 'watching',
}

const TAKE: Record<string, string> = {
  make: 'take',
  made: 'took',
  making: 'taking',
  do: 'take',
  did: 'took',
  doing: 'taking',
}

const LISTEN: Record<string, string> = {
  listen: 'listen to',
  listened: 'listened to',
  listening: 'listening to',
}

const TELL: Record<string, string> = {
  say: 'tell',
  said: 'told',
  saying: 'telling',
}

/** Conserva la mayúscula inicial del verbo al reemplazarlo. */
function matchCase(original: string, replacement: string): string {
  if (original.length > 1 && original === original.toUpperCase()) return replacement.toUpperCase()
  if (original[0] === original[0]?.toUpperCase()) {
    return replacement[0]!.toUpperCase() + replacement.slice(1)
  }
  return replacement
}

function replaceFirst(text: string, word: string, replacement: string): string {
  return text.replace(new RegExp(String.raw`\b${word}\b`, 'i'), matchCase(word, replacement))
}

const RULES: ContextRule[] = [
  {
    pattern: new RegExp(String.raw`\b(see|saw|seen|seeing)\b([^.!?\n]{0,90}?)${MEDIA}`, 'i'),
    correctionStem: 'watch',
    build: match => {
      const verb = match[1]!.toLowerCase()
      const replacement = WATCH[verb] ?? 'watch'
      return {
        correction: replaceFirst(match[0], match[1]!, replacement),
        explanation: 'Para películas, series o partidos se usa "watch", no "see".',
      }
    },
  },
  {
    pattern: new RegExp(String.raw`\b(look at)\b([^.!?\n]{0,90}?)${MEDIA}`, 'i'),
    correctionStem: 'watch',
    build: match => ({
      correction: replaceFirst(match[0], match[1]!, 'watch'),
      explanation: 'Para películas o series se usa "watch", no "look at".',
    }),
  },
  {
    pattern: /\b(listen)\b(?!\s+to\b)([^.!?\n]{0,90}?)\b(music|radio|podcast|podcasts|song|songs)\b/i,
    correctionStem: 'listen to',
    build: match => ({
      correction: replaceFirst(match[0], match[1]!, LISTEN[match[1]!.toLowerCase()] ?? 'listen to'),
      explanation: 'Con música o radio se dice "listen to", no "listen".',
    }),
  },
  {
    pattern: /\b(make|made|making|do|did|doing)\b([^.!?\n]{0,90}?)\b(photo|photos|picture|pictures|selfie|selfies)\b/i,
    correctionStem: 'take',
    build: match => ({
      correction: replaceFirst(match[0], match[1]!, TAKE[match[1]!.toLowerCase()] ?? 'take'),
      explanation: 'Las fotos se "take", no se "make" ni se "do".',
    }),
  },
  {
    pattern: /\b(say|said|saying)\s+(me|him|her|us|them)\b/i,
    correctionStem: 'tell',
    build: match => ({
      correction: replaceFirst(match[0], match[1]!, TELL[match[1]!.toLowerCase()] ?? 'tell'),
      explanation: 'Se dice "tell me/him/her", no "say me".',
    }),
  },
]

function alreadyCovered(
  improvements: EvaluationImprovement[],
  fix: EvaluationImprovement,
  verbForm: string,
  stem: string,
): boolean {
  const lastWord = fix.original.match(/[a-záéíóúñ]+$/i)?.[0]?.toLowerCase() ?? ''
  return improvements.some(item => {
    const original = item.original.toLowerCase()
    const correction = item.correction.toLowerCase()
    return (
      original.includes(verbForm.toLowerCase()) &&
      correction.includes(stem) &&
      (!lastWord || correction.includes(lastWord))
    )
  })
}

/**
 * Añade las correcciones contextuales que la IA no haya puesto ya. Se
 * priorizan al principio y se mantiene el límite de 4 mejoras del informe.
 */
export function addContextualVerbImprovements(
  improvements: EvaluationImprovement[],
  responseText: string,
): EvaluationImprovement[] {
  const extra: EvaluationImprovement[] = []

  for (const rule of RULES) {
    if (improvements.length + extra.length >= 4) break
    const match = responseText.match(rule.pattern)
    if (!match) continue

    const built = rule.build(match)
    const fix: EvaluationImprovement = {
      original: match[0].trim(),
      correction: built.correction.trim(),
      explanation: built.explanation,
    }
    if (!fix.original || !fix.correction) continue
    if (alreadyCovered(improvements, fix, match[1]!, rule.correctionStem)) continue
    extra.push(fix)
  }

  return [...extra, ...improvements].slice(0, 4)
}
