import type { IntroductionCharacter, MissionIntroduction } from './types'

/** Normaliza una frase para comparar la reescritura (mayúsculas y puntuación no cuentan). */
export function normalizeSentence(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:"'’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Personajes de la escena que necesita la preparación y el chat. */
export function missionCharacters(introduction: MissionIntroduction | null): {
  ai: IntroductionCharacter | undefined
  student: IntroductionCharacter | undefined
} {
  return {
    ai: introduction?.characters.find(character => character.played_by === 'ai'),
    student: introduction?.characters.find(character => character.played_by === 'student'),
  }
}
