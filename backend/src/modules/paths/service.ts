/**
 * Rutas por objetivo: la rebanada del nivel del alumno en cada itinerario.
 *
 * Las rutas son datos (`lib/learning-paths.ts`); aquí se cruzan con el
 * catálogo real de misiones y con lo completado (misma fuente que el álbum y
 * las medallas). Las rutas sin misiones del nivel del alumno se ocultan.
 */
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { missions, narrative_states, users } from '../../db/schema.ts'
import { LEARNING_PATHS } from '../../lib/learning-paths.ts'

export interface PathMissionView {
  mission_id: string
  title: string
  tier: number | null
  status: 'completed' | 'pending'
}

export interface LearningPathView {
  id: string
  label: string
  description: string
  icon: string
  total: number
  completed: number
  missions: PathMissionView[]
}

export interface PathsView {
  level: string
  paths: LearningPathView[]
}

/** Rutas del alumno: misiones de su nivel, en el orden curado, con progreso. */
export async function getStudentPaths(studentId: string): Promise<PathsView> {
  const [studentRow] = await db
    .select({ cefr_level: users.cefr_level })
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1)
  const level = studentRow?.cefr_level ?? 'A1'

  const allIds = [...new Set(LEARNING_PATHS.flatMap(path => path.missions))]
  const [missionRows, completedRows] = await Promise.all([
    db
      .select({ id: missions.id, title: missions.title, level: missions.cefr_level, tier: missions.tier })
      .from(missions)
      .where(inArray(missions.id, allIds)),
    db
      .select({ mission_id: narrative_states.mission_id })
      .from(narrative_states)
      .where(and(eq(narrative_states.student_id, studentId), eq(narrative_states.state, 'completed'))),
  ])

  const missionById = new Map(missionRows.map(row => [row.id, row]))
  const completed = new Set(completedRows.map(row => row.mission_id))

  const paths: LearningPathView[] = LEARNING_PATHS.flatMap(path => {
    const pathMissions: PathMissionView[] = path.missions.flatMap(missionId => {
      const mission = missionById.get(missionId)
      if (!mission || mission.level !== level) return []
      return [{
        mission_id: mission.id,
        title: mission.title,
        tier: mission.tier,
        status: completed.has(mission.id) ? ('completed' as const) : ('pending' as const),
      }]
    })

    if (pathMissions.length === 0) return []
    return [{
      id: path.id,
      label: path.label,
      description: path.description,
      icon: path.icon,
      total: pathMissions.length,
      completed: pathMissions.filter(mission => mission.status === 'completed').length,
      missions: pathMissions,
    }]
  })

  return { level, paths }
}
