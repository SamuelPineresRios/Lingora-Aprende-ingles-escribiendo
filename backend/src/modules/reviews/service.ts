/**
 * Repaso de vocabulario (SRS).
 *
 * Las palabras guardadas vuelven a los 1, 3, 7 y 21 días. El ejercicio pone la
 * frase de ejemplo con la palabra en blanco y opciones sacadas del propio
 * vocabulario del alumno; la corrección es del servidor (no se fía del
 * cliente) y actualiza el calendario de cada palabra.
 */
import { and, asc, eq, isNotNull, lte, sql } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { saved_words, word_lookups } from '../../db/schema.ts'
import { HttpError } from '../../utils/http-error.ts'
import { nextSchedule, type ReviewSchedule } from '../../lib/srs.ts'

export interface ReviewItem {
  saved_id: string
  /** La palabra no se manda hasta responder: aquí va la frase con el hueco. */
  prompt: string
  options: string[]
}

export interface DueReviews {
  due: number
  items: ReviewItem[]
}

export interface ReviewResult {
  correct: boolean
  /** La palabra correcta, ya resuelta. */
  answer: string
  translation: string
  schedule: ReviewSchedule
  /** Repasos que siguen pendientes. */
  due: number
}

/** Oculta la palabra dentro de la frase de ejemplo. */
function maskWord(example: string, word: string): string {
  const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*`, 'gi')
  return example.replace(pattern, '____')
}

/** Mezcla una lista (Fisher-Yates); aquí no hace falta determinismo. */
function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = copy[i]!
    copy[i] = copy[j]!
    copy[j] = tmp
  }
  return copy
}

async function countDue(studentId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(saved_words)
    .where(
      and(
        eq(saved_words.student_id, studentId),
        isNotNull(saved_words.review_due_at),
        lte(saved_words.review_due_at, new Date()),
      ),
    )
  return row?.total ?? 0
}

/**
 * Repasos que tocan ahora (hasta `limit`) con su ejercicio.
 *
 * Los distractores salen del vocabulario del propio alumno: repasan dos veces
 * (la correcta y las que aparecen como opción) y el ejercicio es suyo.
 */
export async function getDueReviews(studentId: string, rawLimit: unknown = 5): Promise<DueReviews> {
  const parsed = Number(rawLimit)
  const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 20) : 5

  const [due, rows, poolRows] = await Promise.all([
    countDue(studentId),
    db
      .select({
        saved_id: saved_words.id,
        word: word_lookups.word,
        translation: word_lookups.translation,
        examples: word_lookups.examples,
      })
      .from(saved_words)
      .innerJoin(word_lookups, eq(word_lookups.id, saved_words.word_lookup_id))
      .where(
        and(
          eq(saved_words.student_id, studentId),
          isNotNull(saved_words.review_due_at),
          lte(saved_words.review_due_at, new Date()),
        ),
      )
      .orderBy(asc(saved_words.review_due_at))
      .limit(limit),
    // Vocabulario completo para los distractores (acotado: no crece sin límite).
    db
      .select({ word: word_lookups.word })
      .from(saved_words)
      .innerJoin(word_lookups, eq(word_lookups.id, saved_words.word_lookup_id))
      .where(eq(saved_words.student_id, studentId))
      .limit(200),
  ])

  const pool = poolRows.map(row => row.word)

  const items: ReviewItem[] = rows.map(row => {
    const examples = (row.examples ?? []) as Array<{ en: string }>
    const example = examples.find(item => item.en.toLowerCase().includes(row.word.toLowerCase()))?.en
    const prompt = example ? maskWord(example, row.word) : `Recuerda el significado de «${row.word}».`
    const distractors = shuffled(pool.filter(word => word.toLowerCase() !== row.word.toLowerCase())).slice(0, 3)

    return {
      saved_id: row.saved_id,
      prompt,
      options: shuffled([row.word, ...distractors]),
    }
  })

  return { due, items }
}

/** Corrige un repaso y reprograma la palabra. */
export async function answerReview(
  studentId: string,
  savedId: string,
  rawOption: unknown,
): Promise<ReviewResult> {
  const option = typeof rawOption === 'string' ? rawOption.trim().toLowerCase() : ''

  const [row] = await db
    .select({
      id: saved_words.id,
      stage: saved_words.review_stage,
      lapses: saved_words.review_lapses,
      word: word_lookups.word,
      translation: word_lookups.translation,
    })
    .from(saved_words)
    .innerJoin(word_lookups, eq(word_lookups.id, saved_words.word_lookup_id))
    .where(and(eq(saved_words.id, savedId), eq(saved_words.student_id, studentId)))
    .limit(1)

  if (!row) throw new HttpError(404, 'Palabra no encontrada')

  const correct = option === row.word.toLowerCase()
  const schedule = nextSchedule(row.stage, correct)

  await db
    .update(saved_words)
    .set({
      review_stage: schedule.stage,
      review_due_at:
        schedule.nextInDays === null ? null : new Date(Date.now() + schedule.nextInDays * 24 * 60 * 60 * 1000),
      reviewed_at: new Date(),
      review_lapses: correct ? row.lapses : row.lapses + 1,
    })
    .where(eq(saved_words.id, row.id))

  return {
    correct,
    answer: row.word,
    translation: row.translation,
    schedule,
    due: await countDue(studentId),
  }
}
