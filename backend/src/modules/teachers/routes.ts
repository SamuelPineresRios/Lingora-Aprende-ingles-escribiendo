/**
 * Rutas HTTP de profesores (montadas en `/api/teachers`).
 *
 * El guard global ya exige rol `teacher` para todo `/api/teachers`; aquí se
 * repite con `requireTeacher` y además se comprueba la propiedad del grupo.
 */
import { Router } from 'express'
import { requireTeacher, sessionOf } from '../../middleware/require-auth.ts'
import { HttpError } from '../../utils/http-error.ts'
import { queryString, routeParam } from '../../utils/route-params.ts'
import {
  createAssignment,
  createGroup,
  getGroupReport,
  getOwnedGroup,
  getStudentProfile,
  groupReportToCsv,
  listGroupAssignments,
  listGroupStudents,
  listGroups,
} from './service.ts'

export const teachersRouter = Router()

const DUE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

teachersRouter.get('/groups', requireTeacher, async (req, res) => {
  const session = sessionOf(req)
  res.json({ groups: await listGroups(session.userId) })
})

teachersRouter.post('/groups/create', requireTeacher, async (req, res) => {
  const session = sessionOf(req)
  const body = (req.body ?? {}) as Record<string, unknown>

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) throw new HttpError(400, 'name required')
  if (!body.parental_consent_confirmed) {
    throw new HttpError(400, 'Consentimiento requerido')
  }

  const institutionName = typeof body.institution_name === 'string' ? body.institution_name.trim() : ''

  const group = await createGroup(session.userId, {
    name,
    institutionName: institutionName || null,
    parentalConsentConfirmed: true,
  })

  res.status(201).json(group)
})

teachersRouter.get('/groups/:id', requireTeacher, async (req, res) => {
  const session = sessionOf(req)
  const group = await getOwnedGroup(session.userId, routeParam(req, 'id'))
  if (!group) throw new HttpError(404, 'Not found')

  res.json(group)
})

/**
 * Informe de la clase en CSV: totales por alumno, avance de las asignadas y
 * actividad. Un clic en el panel y a la hoja de cálculo.
 */
teachersRouter.get('/groups/:id/report.csv', requireTeacher, async (req, res) => {
  const session = sessionOf(req)
  const groupId = routeParam(req, 'id')
  const group = await getOwnedGroup(session.userId, groupId)
  if (!group) throw new HttpError(404, 'Not found')

  const slug =
    group.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'grupo'

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="informe-${slug}.csv"`)
  res.send(groupReportToCsv(await getGroupReport(groupId)))
})

teachersRouter.get('/groups/:id/students', requireTeacher, async (req, res) => {
  const session = sessionOf(req)
  const group = await getOwnedGroup(session.userId, routeParam(req, 'id'))
  if (!group) throw new HttpError(403, 'Forbidden')

  res.json(await listGroupStudents(group.id))
})

teachersRouter.get('/groups/:id/assign-mission', requireTeacher, async (req, res) => {
  const session = sessionOf(req)
  const group = await getOwnedGroup(session.userId, routeParam(req, 'id'))
  if (!group) throw new HttpError(403, 'Forbidden')

  res.json({ assignments: await listGroupAssignments(group.id) })
})

teachersRouter.post('/groups/:id/assign-mission', requireTeacher, async (req, res) => {
  const session = sessionOf(req)
  const group = await getOwnedGroup(session.userId, routeParam(req, 'id'))
  if (!group) throw new HttpError(403, 'Forbidden')

  const body = (req.body ?? {}) as Record<string, unknown>
  const missionId = typeof body.mission_id === 'string' ? body.mission_id : ''
  if (!missionId) throw new HttpError(400, 'mission_id required')

  const rawDueDate = body.due_date
  const dueDate =
    typeof rawDueDate === 'string' && DUE_DATE_PATTERN.test(rawDueDate) ? rawDueDate : null

  const assignment = await createAssignment({
    teacherId: session.userId,
    groupId: group.id,
    missionId,
    dueDate,
  })

  res.status(201).json(assignment)
})

teachersRouter.get('/students/:id/profile', requireTeacher, async (req, res) => {
  const session = sessionOf(req)
  const profile = await getStudentProfile(session.userId, routeParam(req, 'id'), {
    groupFilter: queryString(req, 'group_id'),
  })

  if (!profile) throw new HttpError(403, 'Forbidden')
  res.json(profile)
})
