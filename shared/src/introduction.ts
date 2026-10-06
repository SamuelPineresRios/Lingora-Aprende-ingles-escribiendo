/**
 * Introducción narrativa de una misión (contrato backend/frontend).
 *
 * Es la escena que el alumno ve antes de entrar a conversar: dos personajes
 * ejemplo con diálogos traducidos. El alumno asume el papel del personaje con
 * `played_by: 'student'`; el otro es el que interpretará el asistente.
 */

import type { MissionBackdrop } from './backdrop.ts'

/** Papel del personaje dentro de la misión. */
export type IntroductionRole = 'ai' | 'student'

export interface IntroductionCharacter {
  /** Referencia usada por las líneas de diálogo. */
  id: 'A' | 'B'
  name: string
  /** Lo que es ese personaje en la escena, p. ej. "Camarero". */
  role: string
  emoji: string
  played_by: IntroductionRole
}

export interface IntroductionLine {
  speaker: 'A' | 'B'
  /** Frase en inglés. */
  text: string
  /** Traducción al español de esa frase. */
  translation: string
}

export interface MissionIntroduction {
  /** Título corto de la escena, p. ej. "En el restaurante". */
  scene_title: string
  /** Cómo es el entorno; alimenta el fondo y el resumen de preparación. */
  scene_description: string
  /** Siempre dos: uno con `played_by: 'ai'` y otro con `played_by: 'student'`. */
  characters: IntroductionCharacter[]
  /** Diálogo ordenado de la escena. */
  lines: IntroductionLine[]
  /** 3-5 expresiones para usar en la misión real. */
  useful_expressions: string[]
  /**
   * Dirección de arte del fondo. Falta en las introducciones antiguas (se
   * cachearon antes de existir): el frontend cae a un fondo por palabras clave.
   */
  backdrop?: MissionBackdrop | null
}
