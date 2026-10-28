/**
 * Ruta HTTP del modo conversación (montada en `/api/chat`).
 *
 * Compone el prompt con el contexto que envía el cliente y lo pasa al
 * proveedor de IA. Además, cuando un turno trae un error que bloquea, lo
 * registra para alimentar los drills de puntos débiles.
 */
import { Router } from 'express'
import { AIProviderError } from '../../lib/ai.ts'
import { guardGuestAiRequest } from '../../lib/guests.ts'
import { requireAuth, sessionOf } from '../../middleware/require-auth.ts'
import { recordGrammarError } from '../drills/service.ts'
import type { MissionContext } from './prompts.ts'
import { requestHints, requestRoleplayTurn } from './service.ts'

export const chatRouter = Router()

/** Contexto de misión con valores por defecto: nunca interpola `undefined`. */
function readMission(value: unknown): MissionContext {
  const mission = (value ?? {}) as Record<string, unknown>
  return {
    character_name:
      typeof mission.character_name === 'string' ? mission.character_name : 'Assistant',
    objective: typeof mission.objective === 'string' ? mission.objective : '',
    scene_context: typeof mission.scene_context === 'string' ? mission.scene_context : '',
  }
}

chatRouter.post('/', requireAuth, async (req, res) => {
  const session = sessionOf(req)
  await guardGuestAiRequest(session.userId)

  const body = (req.body ?? {}) as Record<string, unknown>
  const mission = readMission(body.mission)
  const userLevel = typeof body.userLevel === 'string' ? body.userLevel : 'A2'
  const mode = typeof body.mode === 'string' ? body.mode : 'chat'

  if (mode === 'hints') {
    const lastMessage = typeof body.lastMessage === 'string' ? body.lastMessage : ''
    res.json(await requestHints({ lastMessage, mission, userLevel }))
    return
  }

  try {
    const result = await requestRoleplayTurn({ rawMessages: body.messages, mission, userLevel })

    // Puntos débiles: el tipo de error del turno (si lo hay) queda registrado.
    const errorType = result.error_type
    if (typeof errorType === 'string') {
      const missionRaw = body.mission as Record<string, unknown> | undefined
      const missionId = typeof missionRaw?.id === 'string' ? missionRaw.id : null
      try {
        await recordGrammarError(session.userId, missionId, errorType)
      } catch (recordError) {
        console.error('[Drills] No se pudo registrar el error:', recordError)
      }
    }

    res.json(result)
  } catch (err) {
    if (err instanceof AIProviderError) {
      // El status del proveedor (401 por clave inválida, 429 por límite...) no
      // se propaga tal cual: un 401 de Anthropic no significa que la sesión
      // del alumno haya caducado. Se registra y se responde 502.
      console.error('[chat] Error del proveedor de IA:', err.status, err.detail)
      res.status(502).json({ error: 'Error del proveedor de IA' })
      return
    }
    throw err
  }
})
