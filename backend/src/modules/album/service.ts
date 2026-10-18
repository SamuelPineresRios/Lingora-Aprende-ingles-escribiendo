/**
 * Álbum de escenas: todas las misiones como colección.
 *
 * Cada misión completada desbloquea su carta (personaje + escena). Las
 * colecciones van por nivel y su premio es la medalla del nivel, que ya
 * otorga el servicio de medallas: aquí solo se refleja su estado.
 */
import { asc, eq } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { mission_introductions, missions, narrative_states } from '../../db/schema.ts'
import { getStudentMedals } from '../medals/service.ts'

/** Orden de los niveles en la colección. */
const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1'] as const

/** Medalla que premia completar cada colección. */
const LEVEL_MEDAL: Record<string, string> = {
  A1: 'dios-a1',
  A2: 'principe-basico',
  B1: 'senor-intermedio',
  B2: 'maestro-avanzado',
  C1: 'leyenda-c1',
}

export interface AlbumCharacter {
  mission_id: string
  title: string
  level: string
  character_name: string
  /** Emoji del personaje si su escena lo trae. */
  emoji: string | null
  gender: 'male' | 'female' | null
  scene_title: string | null
  unlocked: boolean
}

export interface AlbumCollection {
  level: string
  total: number
  unlocked: number
  medal: { id: string; name: string; icon: string; earned: boolean }
}

export interface AlbumView {
  total: number
  unlocked: number
  collections: AlbumCollection[]
  characters: AlbumCharacter[]
}

/**
 * Vista del álbum: cartas por nivel (desbloqueadas al completar la misión) y
 * colecciones con su medalla. Leer el álbum también actualiza las medallas.
 */
export async function getAlbum(studentId: string): Promise<AlbumView> {
  const [missionRows, introRows, completedRows, medalView] = await Promise.all([
    db
      .select({
        id: missions.id,
        title: missions.title,
        level: missions.cefr_level,
        character_name: missions.character_name,
      })
      .from(missions)
      .orderBy(asc(missions.tier), asc(missions.id)),
    db
      .select({
        mission_id: mission_introductions.mission_id,
        scene_title: mission_introductions.scene_title,
        characters: mission_introductions.characters,
      })
      .from(mission_introductions),
    db
      .select({ mission_id: narrative_states.mission_id })
      .from(narrative_states)
      .where(eq(narrative_states.student_id, studentId)),
    getStudentMedals(studentId),
  ])

  const introByMission = new Map(introRows.map(row => [row.mission_id, row]))
  const unlockedIds = new Set(completedRows.map(row => row.mission_id))
  const medalEarned = new Map(medalView.medals.map(medal => [medal.id, medal.earned]))

  const characters: AlbumCharacter[] = missionRows.map(mission => {
    const intro = introByMission.get(mission.id)
    const aiCharacter = intro?.characters?.find(character => character.played_by === 'ai')
    return {
      mission_id: mission.id,
      title: mission.title,
      level: mission.level,
      character_name: aiCharacter?.name ?? mission.character_name ?? 'Personaje',
      emoji: aiCharacter?.emoji ?? null,
      gender: aiCharacter?.gender ?? null,
      scene_title: intro?.scene_title ?? null,
      unlocked: unlockedIds.has(mission.id),
    }
  })

  const collections: AlbumCollection[] = LEVEL_ORDER.flatMap(level => {
    const cards = characters.filter(character => character.level === level)
    if (cards.length === 0) return []
    const unlocked = cards.filter(card => card.unlocked).length
    const medalId = LEVEL_MEDAL[level] ?? ''
    const medal = medalView.medals.find(item => item.id === medalId)
    return [{
      level,
      total: cards.length,
      unlocked,
      medal: {
        id: medalId,
        name: medal?.name ?? `Colección ${level}`,
        icon: medal?.icon ?? 'award',
        earned: medalEarned.get(medalId) ?? false,
      },
    }]
  })

  return {
    total: characters.length,
    unlocked: characters.filter(card => card.unlocked).length,
    collections,
    characters,
  }
}
