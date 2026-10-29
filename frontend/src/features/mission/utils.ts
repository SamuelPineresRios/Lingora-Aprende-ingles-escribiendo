import type { IntroductionCharacter, MissionIntroduction } from './types'

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
