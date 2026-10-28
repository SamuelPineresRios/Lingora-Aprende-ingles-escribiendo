/**
 * Álbum de escenas: todas las misiones como colección.
 *
 * Cada misión completada desbloquea su carta (personaje + escena). Las
 * colecciones van por nivel y su premio es la medalla del nivel, que ya
 * otorga el servicio de medallas: aquí solo se refleja su estado.
 *
 * Las cartas se piden de 10 en 10: cargar las 150 escenas de golpe tardaba
 * más y castigaba la consulta. Las colecciones y los totales se calculan con
 * agregados, sin traer las introducciones de todas las misiones.
 */
import type { CefrLevel } from '@vox/shared'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { mission_introductions, missions, narrative_states } from '../../db/schema.ts'
import { getStudentMedals } from '../medals/service.ts'

/** Orden de los niveles en la colección. */
export const ALBUM_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const

/** Cartas por página. */
export const ALBUM_PAGE_SIZE = 10

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

export interface AlbumPagination {
  /** `all` o el nivel filtrado. */
  level: string
  page: number
  page_size: number
  /** Cartas que cumplen el filtro (no el total global). */
  total: number
  pages: number
}

export interface AlbumView {
  total: number
  unlocked: number
  collections: AlbumCollection[]
  characters: AlbumCharacter[]
  pagination: AlbumPagination
}

export type AlbumLevel = (typeof ALBUM_LEVELS)[number]

export interface AlbumOptions {
  /** Nivel a mostrar; `null` para todos. */
  level?: CefrLevel | null
  page?: number
}

/**
 * Página del álbum: cartas del nivel elegido, con las colecciones y sus
 * medallas. Leer el álbum también actualiza las medallas.
 */
export async function getAlbum(studentId: string, options: AlbumOptions = {}): Promise<AlbumView> {
  const level = options.level ?? null
  const page = Math.max(1, Math.floor(options.page ?? 1))
  const whereLevel = level ? eq(missions.cefr_level, level) : sql`true`

  const [filteredCountRows, missionRows, totalsRows, unlockedByLevelRows, medalView] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(missions)
        .where(whereLevel),
      db
        .select({
          id: missions.id,
          title: missions.title,
          level: missions.cefr_level,
          character_name: missions.character_name,
          scene_title: mission_introductions.scene_title,
          characters: mission_introductions.characters,
        })
        .from(missions)
        .leftJoin(mission_introductions, eq(mission_introductions.mission_id, missions.id))
        .where(whereLevel)
        .orderBy(asc(missions.tier), asc(missions.id))
        .limit(ALBUM_PAGE_SIZE)
        .offset((page - 1) * ALBUM_PAGE_SIZE),
      db
        .select({ level: missions.cefr_level, count: sql<number>`count(*)::int` })
        .from(missions)
        .groupBy(missions.cefr_level),
      db
        .select({
          level: missions.cefr_level,
          count: sql<number>`count(distinct ${narrative_states.mission_id})::int`,
        })
        .from(narrative_states)
        .innerJoin(missions, eq(missions.id, narrative_states.mission_id))
        .where(eq(narrative_states.student_id, studentId))
        .groupBy(missions.cefr_level),
      getStudentMedals(studentId),
    ])

  const pageIds = missionRows.map(row => row.id)
  const unlockedPageRows = pageIds.length
    ? await db
        .select({ mission_id: narrative_states.mission_id })
        .from(narrative_states)
        .where(
          and(
            eq(narrative_states.student_id, studentId),
            inArray(narrative_states.mission_id, pageIds),
          ),
        )
    : []
  const unlockedPage = new Set(unlockedPageRows.map(row => row.mission_id))

  const characters: AlbumCharacter[] = missionRows.map(mission => {
    const aiCharacter = mission.characters?.find(character => character.played_by === 'ai')
    return {
      mission_id: mission.id,
      title: mission.title,
      level: mission.level,
      character_name: aiCharacter?.name ?? mission.character_name ?? 'Personaje',
      emoji: aiCharacter?.emoji ?? null,
      gender: aiCharacter?.gender ?? null,
      scene_title: mission.scene_title ?? null,
      unlocked: unlockedPage.has(mission.id),
    }
  })

  const totalsByLevel = new Map(totalsRows.map(row => [row.level, row.count]))
  const unlockedByLevel = new Map(unlockedByLevelRows.map(row => [row.level, row.count]))
  const medalEarned = new Map(medalView.medals.map(medal => [medal.id, medal.earned]))

  const collections: AlbumCollection[] = ALBUM_LEVELS.flatMap(levelName => {
    const levelTotal = totalsByLevel.get(levelName) ?? 0
    if (levelTotal === 0) return []
    const medalId = LEVEL_MEDAL[levelName] ?? ''
    const medal = medalView.medals.find(item => item.id === medalId)
    return [{
      level: levelName,
      total: levelTotal,
      unlocked: unlockedByLevel.get(levelName) ?? 0,
      medal: {
        id: medalId,
        name: medal?.name ?? `Colección ${levelName}`,
        icon: medal?.icon ?? 'award',
        earned: medalEarned.get(medalId) ?? false,
      },
    }]
  })

  const total = totalsRows.reduce((sum, row) => sum + row.count, 0)
  const unlocked = unlockedByLevelRows.reduce((sum, row) => sum + row.count, 0)
  const filteredTotal = filteredCountRows[0]?.count ?? 0

  return {
    total,
    unlocked,
    collections,
    characters,
    pagination: {
      level: level ?? 'all',
      page,
      page_size: ALBUM_PAGE_SIZE,
      total: filteredTotal,
      pages: Math.max(1, Math.ceil(filteredTotal / ALBUM_PAGE_SIZE)),
    },
  }
}
