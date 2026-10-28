/**
 * Rutas HTTP de misiones (montadas en `/api/missions`).
 */
import { Router, type Response } from 'express'
import { requireAuth, sessionOf } from '../../middleware/require-auth.ts'
import { HttpError } from '../../utils/http-error.ts'
import { routeParam } from '../../utils/route-params.ts'
import {
  getMissionById,
  listMissions,
  markMissionCompleted,
  submitResponse,
} from './service.ts'

export const missionsRouter = Router()

/** Las respuestas de misiones incluyen estado mutable: no deben cachearse. */
function disableCaching(res: Response): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
}

function readTimeTakenSeconds(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null
}

missionsRouter.get('/', requireAuth, async (req, res) => {
  const session = sessionOf(req)
  const data = await listMissions(session.userId)

  disableCaching(res)
  res.json(data)
})

missionsRouter.get('/:id', requireAuth, async (req, res) => {
  const mission = await getMissionById(routeParam(req, 'id'))
  if (!mission) throw new HttpError(404, 'Mission not found')

  disableCaching(res)
  res.json({ mission, narrative_state: null })
})

missionsRouter.post('/:id/submit', requireAuth, async (req, res) => {
  const session = sessionOf(req)
  const body = (req.body ?? {}) as Record<string, unknown>

  const responseText = typeof body.response_text === 'string' ? body.response_text : ''
  if (!responseText.trim()) throw new HttpError(400, 'response_text required')

  const groupId = typeof body.group_id === 'string' ? body.group_id : null
  // La práctica libre no paga XP: solo el Desafío puntúa.
  const mode = body.mode === 'free' ? 'free' : 'evaluation'

  const outcome = await submitResponse({
    studentId: session.userId,
    missionId: routeParam(req, 'id'),
    responseText,
    groupId,
    timeTakenSeconds: readTimeTakenSeconds(body.time_taken_seconds),
    timezone: body.tz,
    mode,
  })

  if (outcome.kind === 'rejected') {
    res.json({
      response_id: outcome.responseId,
      evaluation_id: outcome.evaluationId,
      judgment: outcome.evaluation.judgment,
      comprehensibility_score: outcome.evaluation.comprehensibility_score,
      feedback_text: outcome.evaluation.feedback_text,
      correctedText: 'Por favor intenta de nuevo con una respuesta seria.',
      progress: 0,
      mission_completed: false,
    })
    return
  }

  res.json({
    response_id: outcome.responseId,
    evaluation_id: outcome.evaluationId,
    judgment: outcome.evaluation.judgment,
    evaluation: outcome.evaluation,
  })
})

missionsRouter.post('/:id/mark-completed', requireAuth, async (req, res) => {
  const session = sessionOf(req)
  const body = (req.body ?? {}) as Record<string, unknown>
  const groupId = typeof body.group_id === 'string' ? body.group_id : null

  await markMissionCompleted(session.userId, routeParam(req, 'id'), groupId)
  res.json({ ok: true })
})
