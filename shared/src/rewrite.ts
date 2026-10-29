/**
 * Comparación flexible de una reescritura con la corrección gramatical.
 *
 * El alumno no debe copiar la corrección literal: puede usar sus palabras.
 * Normalizamos contracciones y puntuación, comparamos por tokens y exigimos
 * que la reescritura esté claramente más cerca de la corrección que de la
 * frase original (así repetir el error no cuela).
 */
export interface RewriteCorrection {
  original: string
  corrected: string
}

export interface RewriteCheck {
  accepted: boolean
  similarity: number
  /** Palabras de la corrección que no aparecen en la reescritura. */
  missing: string[]
  /** Palabras añadidas por el alumno que no están en la corrección. */
  extra: string[]
}

const CONTRACTIONS: Array<[RegExp, string]> = [
  [/\bi'm\b/g, 'i am'],
  [/\byou're\b/g, 'you are'],
  [/\bwe're\b/g, 'we are'],
  [/\bthey're\b/g, 'they are'],
  [/\bhe's\b/g, 'he is'],
  [/\bshe's\b/g, 'she is'],
  [/\bit's\b/g, 'it is'],
  [/\bthat's\b/g, 'that is'],
  [/\bthere's\b/g, 'there is'],
  [/\bwhat's\b/g, 'what is'],
  [/\blet's\b/g, 'let us'],
  [/\bi've\b/g, 'i have'],
  [/\byou've\b/g, 'you have'],
  [/\bwe've\b/g, 'we have'],
  [/\bthey've\b/g, 'they have'],
  [/\bi'll\b/g, 'i will'],
  [/\byou'll\b/g, 'you will'],
  [/\bhe'll\b/g, 'he will'],
  [/\bshe'll\b/g, 'she will'],
  [/\bwe'll\b/g, 'we will'],
  [/\bthey'll\b/g, 'they will'],
  [/\bi'd\b/g, 'i would'],
  [/\byou'd\b/g, 'you would'],
  [/\bhe'd\b/g, 'he would'],
  [/\bshe'd\b/g, 'she would'],
  [/\bwe'd\b/g, 'we would'],
  [/\bthey'd\b/g, 'they would'],
  [/\bdon't\b/g, 'do not'],
  [/\bdoesn't\b/g, 'does not'],
  [/\bdidn't\b/g, 'did not'],
  [/\bisn't\b/g, 'is not'],
  [/\baren't\b/g, 'are not'],
  [/\bwasn't\b/g, 'was not'],
  [/\bweren't\b/g, 'were not'],
  [/\bhaven't\b/g, 'have not'],
  [/\bhasn't\b/g, 'has not'],
  [/\bhadn't\b/g, 'had not'],
  [/\bcan't\b/g, 'cannot'],
  [/\bcouldn't\b/g, 'could not'],
  [/\bwon't\b/g, 'will not'],
  [/\bwouldn't\b/g, 'would not'],
  [/\bshouldn't\b/g, 'should not'],
  [/\bmustn't\b/g, 'must not'],
]

const ACCEPT_SIMILARITY = 0.8

export function tokenizeRewrite(text: string): string[] {
  let value = text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  value = value.replace(/[’‘]/g, "'")
  for (const [pattern, replacement] of CONTRACTIONS) value = value.replace(pattern, replacement)
  value = value.replace(/cannot/g, 'can not').replace(/'s\b/g, 's')
  value = value.replace(/[^a-z0-9]+/g, ' ')
  return value.trim().split(/\s+/).filter(Boolean)
}

function distance(a: string[], b: string[]): number {
  const rows = a.length + 1
  const cols = b.length + 1
  let previous = Array.from({ length: cols }, (_, index) => index)

  for (let i = 1; i < rows; i++) {
    const current = [i]
    for (let j = 1; j < cols; j++) {
      const substitution = previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, substitution)
    }
    previous = current
  }

  return previous[b.length] ?? 0
}

/** Diferencia por subsecuencia común; conserva repeticiones. */
function diffTokens(input: string[], correction: string[]): { missing: string[]; extra: string[] } {
  const rows = input.length + 1
  const cols = correction.length + 1
  const dp = Array.from({ length: rows }, () => Array<number>(cols).fill(0))

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      dp[i]![j] =
        input[i - 1] === correction[j - 1]
          ? dp[i - 1]![j - 1]! + 1
          : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!)
    }
  }

  const missing: string[] = []
  const extra: string[] = []
  let i = input.length
  let j = correction.length

  while (i > 0 && j > 0) {
    if (input[i - 1] === correction[j - 1]) {
      i -= 1
      j -= 1
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      extra.push(input[i - 1]!)
      i -= 1
    } else {
      missing.push(correction[j - 1]!)
      j -= 1
    }
  }
  while (i > 0) extra.push(input[--i]!)
  while (j > 0) missing.push(correction[--j]!)

  return { missing, extra }
}

export function checkRewrite(input: string, correction: RewriteCorrection): RewriteCheck {
  const inputTokens = tokenizeRewrite(input)
  const correctedTokens = tokenizeRewrite(correction.corrected)
  const originalTokens = tokenizeRewrite(correction.original)

  const toCorrected = distance(inputTokens, correctedTokens)
  const toOriginal = distance(inputTokens, originalTokens)
  const length = Math.max(inputTokens.length, correctedTokens.length, 1)
  const similarity = 1 - toCorrected / length
  const { missing, extra } = diffTokens(inputTokens, correctedTokens)

  return {
    accepted: similarity >= ACCEPT_SIMILARITY && toCorrected <= toOriginal,
    similarity,
    missing,
    extra,
  }
}

/**
 * Devuelve un inicio de la frase corregida, nunca la frase completa.
 * Se usa en las pistas de reescritura para no regalar la respuesta.
 */
export function rewriteHint(corrected: string, fraction: number): string {
  const words = corrected.trim().split(/\s+/).filter(Boolean)
  if (words.length <= 1) return ''
  const count = Math.min(words.length - 1, Math.max(1, Math.floor(words.length * fraction)))
  return `${words.slice(0, count).join(' ')}…`
}
