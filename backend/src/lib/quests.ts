/**
 * Retos diarios y reto semanal, y el premio sorpresa del cofre.
 *
 * El progreso no se guarda: sale de la actividad del alumno en el periodo
 * (hoy en su zona, o la semana en curso). Lo único que se persiste es el
 * reclamo (`quest_claims`), que paga monedas al libro.
 */
export type QuestPeriod = 'day' | 'week'
export type QuestMetric = 'missions' | 'xp' | 'minutes' | 'words' | 'perfect'

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
  /** Palabras nuevas guardadas en el vocabulario personal. */
  words: number
  /** Misiones con nota media alta (85 o más). */
  perfect: number
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
  {
    id: 'diaria-palabras',
    period: 'day',
    label: 'Guarda 2 palabras nuevas',
    description: 'Al tocar una palabra en la conversación puedes guardarla en tu vocabulario.',
    target: 2,
    metric: 'words',
    coins: 25,
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
  {
    id: 'semanal-xp',
    period: 'week',
    label: 'Reto de la semana: 400 XP',
    description: 'Una semana de conversaciones serias.',
    target: 400,
    metric: 'xp',
    coins: 150,
  },
  {
    id: 'semanal-perfectas',
    period: 'week',
    label: 'Reto de la semana: 3 misiones con nota alta',
    description: 'Tres conversaciones con nota media de 85 o más.',
    target: 3,
    metric: 'perfect',
    coins: 150,
  },
]

/** Un premio del cofre: monedas o un escudo de racha. */
export interface ChestReward {
  kind: 'coins' | 'shield'
  /** Monedas del premio (0 o ausente cuando es un escudo). */
  coins?: number
  /** Peso relativo sobre 100 en el sorteo. */
  weight: number
  label: string
}

/**
 * Premios del cofre diario, de común a raro.
 *
 * La media esperada ronda las 70 monedas: parecido al cofre fijo de antes,
 * pero con la emoción del sorteo y un escudo de racha entre los raros.
 */
export const CHEST_REWARDS: ChestReward[] = [
  { kind: 'coins', coins: 40, weight: 40, label: '40 monedas' },
  { kind: 'coins', coins: 80, weight: 30, label: '80 monedas' },
  { kind: 'coins', coins: 150, weight: 20, label: '150 monedas' },
  { kind: 'coins', coins: 300, weight: 7, label: '¡300 monedas!' },
  { kind: 'shield', weight: 3, label: 'Escudo de racha' },
]

/** Cofre del día: se abre al reclamar todos los retos diarios. */
export const DAILY_CHEST = { id: 'cofre-diario' }

/** Sorteo del cofre; `random` en [0, 1) para poder fijarlo en los tests. */
export function rollChestReward(random: number = Math.random()): ChestReward {
  const total = CHEST_REWARDS.reduce((sum, reward) => sum + reward.weight, 0)
  let threshold = random * total
  for (const reward of CHEST_REWARDS) {
    threshold -= reward.weight
    if (threshold < 0) return reward
  }
  return CHEST_REWARDS[CHEST_REWARDS.length - 1]!
}

/** XP extra (%) de la sorpresa del día. */
export const SURPRISE_XP_PERCENT = 150

export function findQuest(questId: string): QuestDefinition | undefined {
  return DAILY_QUESTS.find(quest => quest.id === questId) ?? WEEKLY_QUESTS.find(quest => quest.id === questId)
}

/** Progreso del reto (recortado al objetivo). */
export function questProgress(quest: QuestDefinition, activity: QuestActivity): number {
  if (quest.metric === 'missions') return Math.min(activity.missions, quest.target)
  if (quest.metric === 'xp') return Math.min(activity.xp, quest.target)
  if (quest.metric === 'words') return Math.min(activity.words, quest.target)
  if (quest.metric === 'perfect') return Math.min(activity.perfect, quest.target)
  return Math.min(Math.floor(activity.seconds / 60), quest.target)
}
