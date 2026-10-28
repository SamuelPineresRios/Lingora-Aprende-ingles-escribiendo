/**
 * Rutas por objetivo: la rebanada del nivel del alumno en cada itinerario.
 *
 * Las rutas son datos (`lib/learning-paths.ts`); aquí se cruzan con el
 * catálogo real de misiones y con lo completado en el Desafío (respuesta
 * completada con XP); la práctica libre deja el Desafío pendiente. Las rutas
 * sin misiones del nivel del alumno se ocultan.
 */
import { eq, inArray } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { missions, users } from '../../db/schema.ts'
import { getMissionCompletions } from '../../lib/mission-completion.ts'
import { LEARNING_PATHS } from '../../lib/learning-paths.ts'

export interface PathMissionView {
  mission_id: string
  title: string
  tier: number | null
  status: 'completed' | 'pending'
  /** Libre hecha, Desafío pendiente: se ofrece «Desafiar» en la ruta. */
  challenge_pending: boolean
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
  const [missionRows, completions] = await Promise.all([
    db
      .select({ id: missions.id, title: missions.title, level: missions.cefr_level, tier: missions.tier })
      .from(missions)
      .where(inArray(missions.id, allIds)),
    getMissionCompletions(studentId),
  ])

  const missionById = new Map(missionRows.map(row => [row.id, row]))

  const paths: LearningPathView[] = LEARNING_PATHS.flatMap(path => {
    const pathMissions: PathMissionView[] = path.missions.flatMap(missionId => {
      const mission = missionById.get(missionId)
      if (!mission || mission.level !== level) return []
      const completion = completions.get(mission.id)
      return [{
        mission_id: mission.id,
        title: mission.title,
        tier: mission.tier,
        status: completion?.challenge ? ('completed' as const) : ('pending' as const),
        challenge_pending: Boolean(completion?.free),
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
