/**
 * Lógica de dominio de misiones: listado con estado, detalle, envío de
 * respuesta (con evaluación por IA y actualización de agregados) y marcado de
 * misión completada con promoción automática de nivel.
 */
import { and, asc, count, eq, gt, inArray, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { CEFR_PROGRESSION, CEFR_THRESHOLDS, type CefrLevel } from '@vox/shared'
import { db } from '../../db/client.ts'
import {
  evaluations,
  group_members,
  mission_introductions,
  missions,
  narrative_states,
  responses,
  users,
  weekly_aggregates,
} from '../../db/schema.ts'
import { missionXp, streakMultiplier } from '../../lib/xp.ts'
import { getMissionCompletions } from '../../lib/mission-completion.ts'
import { assertGuestCanSubmit, isGuestUser } from '../../lib/guests.ts'
import { HttpError } from '../../utils/http-error.ts'
import { getActivityStreak } from '../students/service.ts'
import { recordChallengeScore } from '../social/service.ts'
import { consumeSurpriseBonus } from '../quests/service.ts'
import { applyWeekendEventBonus } from '../events/service.ts'
import { getWeekStart } from '../../utils/week.ts'
import { safeTimeZone, todayKeyIn } from '../../lib/date-keys.ts'
import {
  NON_GENUINE_EVALUATION,
  evaluateResponse,
  isGenuineResponse,
  type EvaluationResult,
} from './evaluation.ts'

export type MissionRow = typeof missions.$inferSelect

export async function listMissions(userId: string) {
  const [userRows, allMissions, states, completions] = await Promise.all([
    db.select({ cefr_level: users.cefr_level }).from(users).where(eq(users.id, userId)).limit(1),
    // Orden por id: estable entre consultas (Postgres no garantiza orden sin ORDER BY).
    // El fondo viaja con la misión para ambientar también las tarjetas; las
    // misiones sin escena generada lo traen en null y el frontend usa su respaldo.
    db
      .select({ mission: missions, backdrop: mission_introductions.backdrop })
      .from(missions)
      .leftJoin(mission_introductions, eq(mission_introductions.mission_id, missions.id))
      .orderBy(asc(missions.tier), asc(missions.id)),
    db.select().from(narrative_states).where(eq(narrative_states.student_id, userId)),
    getMissionCompletions(userId),
  ])

  const cefrLevel = userRows[0]?.cefr_level ?? 'A1'
  const stateByMission = new Map(states.map(state => [state.mission_id, state]))

  const missionsWithStatus = allMissions.map(({ mission, backdrop }) => {
    const state = stateByMission.get(mission.id)
    const completion = completions.get(mission.id)
    return {
      ...mission,
      backdrop: backdrop ?? null,
      status: completion?.challenge
        ? 'completed'
        : completion?.free
          ? 'challenge_pending'
          : state?.state === 'completed'
            ? 'paused'
            : state?.state === 'paused'
              ? 'paused'
              : state
                ? 'in_progress'
                : 'not_started',
    }
  })

  return { missions: missionsWithStatus, cefr_level: cefrLevel }
}

export async function getMissionById(missionId: string): Promise<MissionRow | null> {
  const [mission] = await db.select().from(missions).where(eq(missions.id, missionId)).limit(1)
  return mission ?? null
}

/**
 * Sólo acepta un group_id del que el alumno sea miembro.
 *
 * El cliente lo envía por query string y podría apuntar a un grupo ajeno; en
 * ese caso la respuesta se guarda sin grupo en lugar de atribuirse a otro
 * (y de paso evita la violación de FK si el grupo no existe).
 */
async function resolveGroupId(studentId: string, groupId: string | null): Promise<string | null> {
  if (!groupId) return null

  const [membership] = await db
    .select({ id: group_members.id })
    .from(group_members)
    .where(and(eq(group_members.group_id, groupId), eq(group_members.student_id, studentId)))
    .limit(1)

  if (!membership) {
    console.warn('[missions] group_id ignorado: el alumno no pertenece al grupo', {
      studentId,
      groupId,
    })
    return null
  }

  return groupId
}

export interface SubmitInput {
  studentId: string
  missionId: string
  responseText: string
  groupId: string | null
  timeTakenSeconds: number | null
  /** Zona horaria del cliente, para medir la racha en su «hoy». */
  timezone?: unknown
  /** `free` = práctica sin XP; `evaluation` = Desafío (sí puntúa). */
  mode: 'free' | 'evaluation'
}

export interface SubmitOutcome {
  /** `rejected`: respuesta no seria, descartada sin IA. `evaluated`: pasó por el modelo. */
  kind: 'rejected' | 'evaluated'
  responseId: string
  evaluationId: string
  evaluation: EvaluationResult
}

const RESPONSE_TEXT = 'text'

export async function submitResponse(input: SubmitInput): Promise<SubmitOutcome> {
  const mission = await getMissionById(input.missionId)
  if (!mission) throw new HttpError(404, 'Mission not found')

  const [user] = await db
    .select({
      cefr_level: users.cefr_level,
      language_preference: users.language_preference,
      is_guest: users.is_guest,
    })
    .from(users)
    .where(eq(users.id, input.studentId))
    .limit(1)

  const cefrLevel: CefrLevel = user?.cefr_level ?? 'B1'
  const feedbackLanguage = user?.language_preference ?? 'es'
  // La prueba no genera XP: al registrarse empieza la progresión real.
  const isGuest = user?.is_guest === true
  await assertGuestCanSubmit(input.studentId, isGuest)
  const groupId = await resolveGroupId(input.studentId, input.groupId)

  const responseId = randomUUID()
  const evaluationId = randomUUID()
  const text = input.responseText.trim()

  if (!isGenuineResponse(text)) {
    console.log('[Submit] Respuesta no genuina rechazada:', text.slice(0, 50))
    const evaluation = { ...NON_GENUINE_EVALUATION }

    // Respuesta y evaluación se guardan juntas o no se guarda ninguna.
    await db.transaction(async tx => {
      await tx.insert(responses).values({
        id: responseId,
        mission_id: input.missionId,
        student_id: input.studentId,
        group_id: groupId,
        text_content: text,
        input_mode: RESPONSE_TEXT,
        transcript: null,
        time_taken_seconds: input.timeTakenSeconds,
        submitted_at: new Date(),
        status: 'in_progress',
      })

      await tx.insert(evaluations).values({
        id: evaluationId,
        response_id: responseId,
        comprehensibility_score: evaluation.comprehensibility_score,
        grammar_score: evaluation.grammar_score,
        lexical_richness_score: evaluation.lexical_richness_score,
        judgment: evaluation.judgment,
        feedback_text: evaluation.feedback_text,
        detected_structures: evaluation.detected_structures,
        improvements: evaluation.improvements,
        transcript: null,
        evaluated_at: new Date(),
        xp_awarded: 0,
      })
    })

    return { kind: 'rejected', responseId, evaluationId, evaluation }
  }

  const evaluation = await evaluateResponse({
    cefrLevel,
    objective: mission.objective,
    sceneContext: mission.scene_context,
    feedbackLanguage,
    responseText: text,
  })

  const threshold = CEFR_THRESHOLDS[cefrLevel]
  // La misión se completa si el modelo juzga ADVANCE o si la puntuación
  // numérica alcanza el umbral del nivel.
  const completed = evaluation.judgment === 'ADVANCE' || evaluation.comprehensibility_score >= threshold
  const weekStart = getWeekStart()
  const timeTaken = input.timeTakenSeconds ?? 0

  // Solo el Desafío puntúa: la práctica libre se guarda sin XP.
  const scored = input.mode === 'evaluation' && !isGuest
  // ¿Ya había completado puntuando esta misión? La primera puntuación paga el
  // bonus; repetir solo da práctica (y evita farmear XP con la misma misión).
  // Una pasada libre previa no gasta el bonus del primer Desafío.
  const firstCompletion =
    completed && scored ? !(await hasScoredCompletion(input.studentId, input.missionId)) : false
  const baseXp = missionXp({
    cefrLevel,
    completed,
    firstCompletion,
    scores: [
      evaluation.comprehensibility_score,
      evaluation.grammar_score,
      evaluation.lexical_richness_score,
    ],
  })

  // La racha multiplica el XP de las misiones completadas; los intentos
  // parciales no la aprovechan (la racha premia terminar).
  const streak = completed ? await getActivityStreak(input.studentId, input.timezone) : 0
  const xpConRacha = completed ? Math.round(baseXp * streakMultiplier(streak)) : baseXp

  // La sorpresa del día añade su bonus si esta es la misión sorteada y no se
  // había consumido; si falla, el envío sigue con el XP normal.
  let xp = scored ? xpConRacha : 0
  if (completed && !isGuest) {
    const dayKey = todayKeyIn(safeTimeZone(input.timezone))
    try {
      xp = await consumeSurpriseBonus(input.studentId, input.missionId, dayKey, xp)
    } catch (err) {
      console.error('[Quests] No se pudo aplicar el bonus de la sorpresa:', err)
    }
    try {
      xp = await applyWeekendEventBonus(input.studentId, input.missionId, mission.cefr_level, dayKey, xp)
    } catch (err) {
      console.error('[Event] No se pudo aplicar el bonus del fin de semana:', err)
    }
  }

  await db.transaction(async tx => {
    await tx.insert(responses).values({
      id: responseId,
      mission_id: input.missionId,
      student_id: input.studentId,
      group_id: groupId,
      text_content: text,
      input_mode: RESPONSE_TEXT,
      transcript: null,
      time_taken_seconds: input.timeTakenSeconds,
      submitted_at: new Date(),
      status: completed ? 'completed' : 'in_progress',
    })

    await tx.insert(evaluations).values({
      id: evaluationId,
      response_id: responseId,
      comprehensibility_score: evaluation.comprehensibility_score,
      grammar_score: evaluation.grammar_score,
      lexical_richness_score: evaluation.lexical_richness_score,
      judgment: evaluation.judgment,
      feedback_text: evaluation.feedback_text,
      detected_structures: evaluation.detected_structures,
      improvements: evaluation.improvements,
      transcript: null,
      evaluated_at: new Date(),
      xp_awarded: xp,
    })

    // Upsert del agregado semanal. La aritmética se hace en SQL (no en JS)
    // para que dos envíos concurrentes no se pisen: el ON CONFLICT serializa
    // sobre la clave única (student_id, week_start_date).
    await tx
      .insert(weekly_aggregates)
      .values({
        id: randomUUID(),
        student_id: input.studentId,
        group_id: groupId,
        week_start_date: weekStart,
        total_writing_time_seconds: timeTaken,
        missions_completed: completed ? 1 : 0,
        avg_comprehensibility: completed ? evaluation.comprehensibility_score : null,
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: [weekly_aggregates.student_id, weekly_aggregates.week_start_date],
        set: {
          total_writing_time_seconds: sql`${weekly_aggregates.total_writing_time_seconds} + ${timeTaken}`,
          missions_completed: completed
            ? sql`${weekly_aggregates.missions_completed} + 1`
            : sql`${weekly_aggregates.missions_completed}`,
          avg_comprehensibility: completed
            ? sql`(COALESCE(${weekly_aggregates.avg_comprehensibility}, 0) * ${weekly_aggregates.missions_completed} + ${evaluation.comprehensibility_score}) / GREATEST(${weekly_aggregates.missions_completed} + 1, 1)`
            : sql`${weekly_aggregates.avg_comprehensibility}`,
          updated_at: sql`now()`,
        },
      })
  })

  // La nota del reto 1v1 se guarda al completar; si falla, no rompe el envío.
  if (completed) {
    try {
      const challengeScore = Math.round(
        (evaluation.comprehensibility_score + evaluation.grammar_score + evaluation.lexical_richness_score) / 3,
      )
      await recordChallengeScore(input.studentId, input.missionId, challengeScore)
    } catch (err) {
      console.error('[Social] No se pudo registrar la nota del reto:', err)
    }
  }

  // El estado narrativo no debe tirar abajo un envío ya persistido.
  try {
    await upsertNarrativeState({
      studentId: input.studentId,
      missionId: input.missionId,
      groupId,
      state: completed ? 'completed' : 'paused',
      characterReaction: completed ? 'positive' : 'confused',
      scenePosition: completed ? 1 : 0,
      updateGroupId: false,
    })
  } catch (err) {
    console.error('[Submit] No se pudo actualizar narrative_states:', err)
  }

  return { kind: 'evaluated', responseId, evaluationId, evaluation }
}

/** ¿Este alumno ya completó puntuando esa misión (algún envío con XP)? */
async function hasScoredCompletion(studentId: string, missionId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: evaluations.id })
    .from(evaluations)
    .innerJoin(responses, eq(responses.id, evaluations.response_id))
    .where(
      and(
        eq(responses.student_id, studentId),
        eq(responses.mission_id, missionId),
        eq(responses.status, 'completed'),
        gt(evaluations.xp_awarded, 0),
      ),
    )
    .limit(1)
  return Boolean(row)
}

interface NarrativeStateInput {
  studentId: string
  missionId: string
  groupId: string | null
  state: string
  characterReaction: string
  scenePosition: number
  /** `submit` no toca el grupo al actualizar; `mark-completed` sí. */
  updateGroupId: boolean
}

async function upsertNarrativeState(input: NarrativeStateInput): Promise<void> {
  const baseSet = {
    state: input.state,
    character_reaction: input.characterReaction,
    scene_position: input.scenePosition,
    updated_at: new Date(),
    ...(input.updateGroupId ? { group_id: input.groupId } : {}),
  }

  await db
    .insert(narrative_states)
    .values({
      id: randomUUID(),
      student_id: input.studentId,
      mission_id: input.missionId,
      group_id: input.groupId,
      state: input.state,
      character_reaction: input.characterReaction,
      scene_position: input.scenePosition,
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: [narrative_states.student_id, narrative_states.mission_id],
      set: baseSet,
    })
}

export async function markMissionCompleted(
  studentId: string,
  missionId: string,
  rawGroupId: string | null,
): Promise<void> {
  // Sin esta comprobación, un mission_id inexistente provocaba una violación
  // de clave foránea (500) en lugar de un 404 entendible.
  const mission = await getMissionById(missionId)
  if (!mission) throw new HttpError(404, 'Mission not found')

  const groupId = await resolveGroupId(studentId, rawGroupId)

  await upsertNarrativeState({
    studentId,
    missionId,
    groupId,
    state: 'completed',
    characterReaction: 'positive',
    scenePosition: 1,
    updateGroupId: true,
  })

  // Un invitado no sube de nivel durante la prueba: eso llega al registrarse.
  if (!(await isGuestUser(studentId))) {
    // La promoción es un efecto secundario: si falla, la misión sigue completada.
    try {
      await promoteIfLevelCompleted(studentId)
    } catch (err) {
      console.error('[MarkCompleted] Error checking promotions:', err)
    }
  }
}

/**
 * Asciende al alumno si ya completó todas las misiones de su nivel actual.
 *
 * El orden sólo llega hasta B2: no existen misiones de C1, así que promover a
 * C1 dejaría al alumno sin progresión posible.
 */
async function promoteIfLevelCompleted(studentId: string): Promise<void> {
  const [user] = await db
    .select({ cefr_level: users.cefr_level })
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1)

  const currentLevel = user?.cefr_level
  if (!currentLevel) return

  const currentIndex = CEFR_PROGRESSION.indexOf(currentLevel)
  if (currentIndex < 0 || currentIndex >= CEFR_PROGRESSION.length - 1) return

  const levelMissions = await db
    .select({ id: missions.id })
    .from(missions)
    .where(eq(missions.cefr_level, currentLevel))

  if (levelMissions.length === 0) return

  const [row] = await db
    .select({ value: count() })
    .from(narrative_states)
    .where(
      and(
        eq(narrative_states.student_id, studentId),
        eq(narrative_states.state, 'completed'),
        inArray(
          narrative_states.mission_id,
          levelMissions.map(mission => mission.id),
        ),
      ),
    )

  const completed = row?.value ?? 0
  if (completed < levelMissions.length) return

  const nextLevel = CEFR_PROGRESSION[currentIndex + 1]
  if (!nextLevel) return

  await db.update(users).set({ cefr_level: nextLevel }).where(eq(users.id, studentId))
  console.log(`[MarkCompleted] User promoted from ${currentLevel} to ${nextLevel}`)
}
