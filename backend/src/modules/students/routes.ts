/**
 * Rutas HTTP de alumnos (montadas en `/api/students`).
 */
import { Router } from 'express'
import type { Request } from 'express'
import { ownsResource } from '../../lib/authorization.ts'
import { requireAuth, sessionOf } from '../../middleware/require-auth.ts'
import { HttpError } from '../../utils/http-error.ts'
import { queryInt, routeParam } from '../../utils/route-params.ts'
import {
  getDailyActivity,
  getGlobalRanking,
  getStudentProgress,
  type RankingMetric,
  getSessionSummary,
  getStudentSkills,
  getWeeklyStats,
  joinGroup,
  listStudentGroups,
} from './service.ts'

export const studentsRouter = Router()

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
/** Tope del rango: un año largo. Evita consultas sin límite. */
const MAX_RANGE_DAYS = 366

/** Lee un parámetro de fecha `YYYY-MM-DD`; 400 si falta o está mal formado. */
function queryDay(req: Request, name: string): string {
  const value = req.query[name]
  if (typeof value !== 'string' || !DAY_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    throw new HttpError(400, `${name} debe tener el formato YYYY-MM-DD`)
  }
  return value
}

studentsRouter.get('/groups', requireAuth, async (req, res) => {
  const session = sessionOf(req)
  const data = await listStudentGroups(session.userId)
  res.status(200).json(data)
})

studentsRouter.post('/join-group', requireAuth, async (req, res) => {
  const session = sessionOf(req)
  const accessCode = typeof req.body?.access_code === 'string' ? req.body.access_code : ''

  if (!accessCode.trim()) throw new HttpError(400, 'access_code required')

  const result = await joinGroup(session.userId, accessCode)

  // Ya era miembro: 200 con `already_member`. Alta nueva: 201 con `joined`.
  if (result.already_member) {
    res.json(result)
    return
  }

  res.status(201).json(result)
})

studentsRouter.get('/:id/weekly-stats', requireAuth, async (req, res) => {
  const session = sessionOf(req)
  const studentId = routeParam(req, 'id')

  if (!ownsResource(session, studentId, ['teacher'])) throw new HttpError(403, 'Forbidden')

  res.json(await getWeeklyStats(studentId))
})

/**
 * Perfil de habilidades del alumno (radar del perfil). Sólo el propio alumno o
 * sus profesores.
 */
studentsRouter.get('/:id/skills', requireAuth, async (req, res) => {
  const session = sessionOf(req)
  const studentId = routeParam(req, 'id')

  if (!ownsResource(session, studentId, ['teacher'])) throw new HttpError(403, 'Forbidden')

  res.json(await getStudentSkills(studentId))
})

studentsRouter.get('/:id/session-summary', requireAuth, async (req, res) => {
  const session = sessionOf(req)
  const studentId = routeParam(req, 'id')

  if (!ownsResource(session, studentId, ['teacher'])) throw new HttpError(403, 'Forbidden')

  res.json(await getSessionSummary(studentId, queryInt(req, 'week_offset', 0)))
})

/** Métrica válida del ranking; por defecto XP. */
function readRankingMetric(value: unknown): RankingMetric {
  return value === 'missions' || value === 'time' ? value : 'xp'
}

/** Tamaño del ranking: 25 por defecto y como mucho 200 para no traer la tabla entera. */
function readRankingLimit(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 25
  return Math.min(Math.floor(parsed), 200)
}

/**
 * Ranking global: quién ha hecho más entre todos los alumnos registrados,
 * según la métrica (xp, misiones o tiempo). Incluye la posición de quien
 * consulta aunque quede fuera del top.
 */
studentsRouter.get('/ranking', requireAuth, async (req, res) => {
  const session = sessionOf(req)
  const metric = readRankingMetric(req.query.metric)
  const limit = readRankingLimit(req.query.limit)

  res.json(await getGlobalRanking(metric, session.userId, limit))
})

/**
 * Progreso gamificado: XP total, nivel, racha, misiones y tiempo. La zona
 * horaria del cliente decide qué cuenta como «hoy» para el XP del día.
 */
studentsRouter.get('/:id/xp', requireAuth, async (req, res) => {
  const session = sessionOf(req)
  const studentId = routeParam(req, 'id')

  if (!ownsResource(session, studentId, ['teacher'])) throw new HttpError(403, 'Forbidden')

  res.json({ progress: await getStudentProgress(studentId, req.query.tz) })
})

/**
 * Historial diario de actividad (misiones completadas, intentos y tiempo) del
 * rango pedido. El cliente manda su zona horaria para que el día coincida con
 * el suyo, no con el de la base de datos.
 */
studentsRouter.get('/:id/activity', requireAuth, async (req, res) => {
  const session = sessionOf(req)
  const studentId = routeParam(req, 'id')

  if (!ownsResource(session, studentId, ['teacher'])) throw new HttpError(403, 'Forbidden')

  const from = queryDay(req, 'from')
  const to = queryDay(req, 'to')

  if (from > to) throw new HttpError(400, 'from no puede ser posterior a to')
  const rangeDays = (Date.parse(to) - Date.parse(from)) / 86_400_000
  if (rangeDays > MAX_RANGE_DAYS) {
    throw new HttpError(400, `El rango máximo es de ${MAX_RANGE_DAYS} días`)
  }

  res.json({ activity: await getDailyActivity(studentId, from, to, req.query.tz) })
})
