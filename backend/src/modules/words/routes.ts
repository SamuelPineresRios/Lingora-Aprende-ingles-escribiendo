/**
 * Rutas del vocabulario (montadas en `/api/words`).
 *
 * - POST /lookup     -> ficha de una palabra (hover de la escena y el chat)
 * - POST /warm       -> calienta en segundo plano las palabras en pantalla
 * - POST /            -> guarda la palabra en el vocabulario del alumno
 * - GET  /            -> vocabulario completo, con fichas
 * - DELETE /:id       -> quita una palabra propia
 */
import { Router } from 'express'
import { requireAuth, sessionOf } from '../../middleware/require-auth.ts'
import { guardGuestAiRequest, isGuestUser } from '../../lib/guests.ts'
import { routeParam } from '../../utils/route-params.ts'
import { deleteSavedWord, listSavedWords, lookupWord, saveWord, warmWords } from './service.ts'

export const wordsRouter = Router()

wordsRouter.post('/lookup', requireAuth, async (req, res) => {
  const session = sessionOf(req)
  await guardGuestAiRequest(session.userId)
  const card = await lookupWord(session.userId, req.body?.word, req.body?.context)
  res.json({ card })
})

/**
 * Calentado: responde 202 sin esperar a la IA. El cliente lo llama al mostrar
 * una escena o una respuesta, para que el hover encuentre la ficha hecha.
 */
wordsRouter.post('/warm', requireAuth, async (req, res) => {
  // El invitado no gasta IA calentando fichas: las pide al pasar el cursor.
  if (await isGuestUser(sessionOf(req).userId)) {
    res.status(202).json({ warmed: 0 })
    return
  }
  res.status(202).json(await warmWords(req.body?.words))
})

wordsRouter.post('/', requireAuth, async (req, res) => {
  const session = sessionOf(req)
  await guardGuestAiRequest(session.userId)
  const card = await saveWord(session.userId, req.body?.word, req.body?.context)
  res.status(201).json({ card })
})

wordsRouter.get('/', requireAuth, async (req, res) => {
  const session = sessionOf(req)
  res.json({ words: await listSavedWords(session.userId) })
})

wordsRouter.delete('/:id', requireAuth, async (req, res) => {
  const session = sessionOf(req)
  await deleteSavedWord(session.userId, routeParam(req, 'id'))
  res.status(204).end()
})
