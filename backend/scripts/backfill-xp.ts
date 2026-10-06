/**
 * Rellena el XP de las evaluaciones anteriores a la fórmula de XP.
 *
 *   npm run xp:backfill -w @vox/backend
 *   npm run xp:backfill -w @vox/backend -- --dry
 *
 * `evaluations.xp_awarded` nació en null: todas las evaluaciones anteriores a
 * la fórmula se quedaron sin puntos. Este script las recorre en orden
 * cronológico por alumno y aplica **las mismas reglas que `submitResponse`**
 * (`lib/xp.ts`, `isGenuineResponse` y el umbral ya reflejado en
 * `responses.status`), respetando cuál fue la primera vez de cada misión.
 *
 * Solo escribe donde `xp_awarded IS NULL`, así que es idempotente y no pisa
 * ningún XP ya calculado. Las evaluaciones ya puntuadas se usan solo para
 * saber qué misiones estaban completadas cuando llegó cada fila histórica.
 */
import { asc, eq } from 'drizzle-orm'
import type { CefrLevel } from '@vox/shared'
import { db } from '../src/db/client.ts'
import { evaluations, responses, users } from '../src/db/schema.ts'
import { missionXp } from '../src/lib/xp.ts'
import { isGenuineResponse } from '../src/modules/missions/evaluation.ts'

const dry = process.argv.includes('--dry')

const rows = await db
  .select({
    id: evaluations.id,
    xp: evaluations.xp_awarded,
    comprehensibility: evaluations.comprehensibility_score,
    grammar: evaluations.grammar_score,
    lexical: evaluations.lexical_richness_score,
    studentId: responses.student_id,
    studentEmail: users.email,
    cefr: users.cefr_level,
    missionId: responses.mission_id,
    status: responses.status,
    text: responses.text_content,
  })
  .from(evaluations)
  .innerJoin(responses, eq(responses.id, evaluations.response_id))
  .innerJoin(users, eq(users.id, responses.student_id))
  .orderBy(asc(responses.submitted_at))

/** Misiones que cada alumno ya había completado al llegar cada fila. */
const completedByStudent = new Map<string, Set<string>>()
const totals = new Map<string, number>()
let updated = 0

for (const row of rows) {
  const completed = row.status === 'completed'
  let done = completedByStudent.get(row.studentId)
  if (!done) {
    done = new Set()
    completedByStudent.set(row.studentId, done)
  }

  if (row.xp === null) {
    const genuine = isGenuineResponse(row.text)
    const xp = genuine
      ? missionXp({
          // Mismo criterio que el código en vivo: el nivel del alumno.
          cefrLevel: (row.cefr ?? 'B1') as CefrLevel,
          completed,
          firstCompletion: completed && !done.has(row.missionId),
          scores: [row.comprehensibility, row.grammar, row.lexical],
        })
      : 0

    const que = completed ? 'completada' : 'parcial'
    console.log(
      `${dry ? '[dry] ' : ''}${row.studentEmail} · ${row.missionId} · ${que}${genuine ? '' : ' (no genuina)'} → ${xp} XP`,
    )

    if (!dry) {
      await db.update(evaluations).set({ xp_awarded: xp }).where(eq(evaluations.id, row.id))
    }
    totals.set(row.studentEmail, (totals.get(row.studentEmail) ?? 0) + xp)
    updated += 1
  }

  if (completed) done.add(row.missionId)
}

console.log(
  dry
    ? `\n[dry] ${updated} evaluaciones históricas recibirían XP:`
    : `\n${updated} evaluaciones históricas actualizadas:`,
)
for (const [email, xp] of totals) console.log(`  ${email}: +${xp} XP`)

process.exit(0)
