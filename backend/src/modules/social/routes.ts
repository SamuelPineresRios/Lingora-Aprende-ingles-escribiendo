/**
 * Rutas HTTP de competición social (montadas en `/api/social`).
 *
 * Todo requiere sesión: las amistades, la liga privada y los retos son
 * siempre del alumno autenticado, nunca de un id que llegue por parámetro.
 */
import { Router } from 'express'
import { requireAuth, sessionOf } from '../../middleware/require-auth.ts'
import { HttpError } from '../../utils/http-error.ts'
import { routeParam } from '../../utils/route-params.ts'
import {
  createChallenge,
  declineChallenge,
  friendsLeague,
  listChallenges,
  listFriends,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
} from './service.ts'
import type { RankingMetric } from '../students/service.ts'

export const socialRouter = Router()

socialRouter.get('/me', requireAuth, async (req, res) => {
  res.json(await listFriends(sessionOf(req).userId))
})

socialRouter.post('/friends/request', requireAuth, async (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code : ''
  res.status(201).json(await sendFriendRequest(sessionOf(req).userId, code))
})

socialRouter.post('/friends/respond', requireAuth, async (req, res) => {
  const requestId = typeof req.body?.request_id === 'string' ? req.body.request_id : ''
  if (!requestId) throw new HttpError(400, 'request_id required')
  res.json(await respondFriendRequest(sessionOf(req).userId, requestId, req.body?.accept === true))
})

socialRouter.delete('/friends/:id', requireAuth, async (req, res) => {
  res.json(await removeFriend(sessionOf(req).userId, routeParam(req, 'id')))
})

socialRouter.get('/league', requireAuth, async (req, res) => {
  const metric: RankingMetric =
    req.query.metric === 'missions' || req.query.metric === 'time' ? req.query.metric : 'xp'
  res.json(await friendsLeague(sessionOf(req).userId, metric))
})

socialRouter.get('/challenges', requireAuth, async (req, res) => {
  res.json({ challenges: await listChallenges(sessionOf(req).userId) })
})

socialRouter.post('/challenges', requireAuth, async (req, res) => {
  const opponentId = typeof req.body?.opponent_id === 'string' ? req.body.opponent_id : ''
  const missionId = typeof req.body?.mission_id === 'string' ? req.body.mission_id : ''
  if (!opponentId || !missionId) throw new HttpError(400, 'opponent_id y mission_id son obligatorios')
  res.status(201).json(await createChallenge(sessionOf(req).userId, opponentId, missionId))
})

socialRouter.post('/challenges/:id/decline', requireAuth, async (req, res) => {
  res.json(await declineChallenge(sessionOf(req).userId, routeParam(req, 'id')))
})
