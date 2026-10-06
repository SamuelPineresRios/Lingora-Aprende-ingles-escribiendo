/**
 * Rutas del vocabulario clave de una misión (montadas en `/api/missions`).
 *
 * - GET  /:id/vocabulary             -> las 5 palabras, o las genera al vuelo
 * - POST /:id/vocabulary/regenerate  -> vocabulario nuevo (solo docentes)
 */
import { Router } from 'express'
import { requireAuth, requireTeacher } from '../../middleware/require-auth.ts'
import { routeParam } from '../../utils/route-params.ts'
import { getOrCreateVocabulary, regenerateVocabulary } from './service.ts'

export const vocabularyRouter = Router()

vocabularyRouter.get('/:id/vocabulary', requireAuth, async (req, res) => {
  const missionId = routeParam(req, 'id')
  res.json({ vocabulary: await getOrCreateVocabulary(missionId) })
})

vocabularyRouter.post('/:id/vocabulary/regenerate', requireTeacher, async (req, res) => {
  const missionId = routeParam(req, 'id')
  res.json({ vocabulary: await regenerateVocabulary(missionId) })
})
