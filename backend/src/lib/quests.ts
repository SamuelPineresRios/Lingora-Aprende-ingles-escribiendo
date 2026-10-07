/**
 * Retos diarios y reto semanal.
 *
 * El progreso no se guarda: sale de las respuestas del alumno en el periodo
 * (hoy en su zona, o la semana en curso). Lo único que se persiste es el
 * reclamo (`quest_claims`), que paga monedas al libro.
 */
export type QuestPeriod = 'day' | 'week'
export type QuestMetric = 'missions' | 'xp' | 'minutes'

export interface QuestDefinition {
  id: string
  period: QuestPeriod
  label: string
  description: string
  target: number
  metric: QuestMetric
  coins: number
}

/** Lo que hizo el alumno en el periodo, para medir cada reto. */
export interface QuestActivity {
  /** Misiones completadas sin repetir. */
  missions: number
  /** XP ganado. */
  xp: number
  /** Segundos de práctica. */
  seconds: number
}

export const DAILY_QUESTS: QuestDefinition[] = [
  {
    id: 'diaria-mision',
    period: 'day',
    label: 'Completa 1 misión',
    description: 'Termina una conversación hoy.',
    target: 1,
    metric: 'missions',
    coins: 30,
  },
  {
    id: 'diaria-xp',
    period: 'day',
    label: 'Gana 100 XP hoy',
    description: 'Acumula XP con tus misiones.',
    target: 100,
    metric: 'xp',
    coins: 40,
  },
  {
    id: 'diaria-minutos',
    period: 'day',
    label: 'Practica 10 minutos',
    description: 'Conversación sin prisa: el tiempo cuenta.',
    target: 10,
    metric: 'minutes',
    coins: 30,
  },
]

export const WEEKLY_QUESTS: QuestDefinition[] = [
  {
    id: 'semanal-misiones',
    period: 'week',
    label: 'Reto de la semana: 5 misiones',
    description: 'Completa cinco conversaciones antes del domingo.',
    target: 5,
    metric: 'missions',
    coins: 120,
  },
]

/** Cofre del día: se abre al reclamar los tres retos diarios. */
export const DAILY_CHEST = { id: 'cofre-diario', coins: 50 }

export function findQuest(questId: string): QuestDefinition | undefined {
  return DAILY_QUESTS.find(quest => quest.id === questId) ?? WEEKLY_QUESTS.find(quest => quest.id === questId)
}

/** Progreso del reto (recortado al objetivo). */
export function questProgress(quest: QuestDefinition, activity: QuestActivity): number {
  if (quest.metric === 'missions') return Math.min(activity.missions, quest.target)
  if (quest.metric === 'xp') return Math.min(activity.xp, quest.target)
  return Math.min(Math.floor(activity.seconds / 60), quest.target)
}
