/**
 * Puntos débiles: tipos de error y banco de ejercicios de práctica.
 *
 * El chat clasifica el error que bloquea en una categoría cerrada y la
 * guarda (`grammar_errors`); con las categorías más repetidas se arma una
 * sesión de drills determinista. Añadir una categoría es añadir su entrada
 * al catálogo y sus ejercicios al banco.
 */

export interface ErrorType {
  id: string
  /** Etiqueta en español, como la leería el alumno. */
  label: string
}

export const ERROR_TYPES: ErrorType[] = [
  { id: 'third_person_s', label: 'la -s de tercera persona' },
  { id: 'word_order', label: 'el orden: sujeto + verbo' },
  { id: 'article', label: 'los artículos (a/an/the)' },
  { id: 'plural', label: 'el plural (-s)' },
  { id: 'auxiliary', label: 'do/does y am/is/are' },
  { id: 'past_tense', label: 'el pasado simple' },
  { id: 'preposition', label: 'las preposiciones' },
  { id: 'other', label: 'otras reglas' },
]

export const ERROR_TYPE_BY_ID = new Map(ERROR_TYPES.map(type => [type.id, type]))

/** Un ejercicio de completar: elegir la opción que encaja en el hueco. */
export interface DrillExercise {
  id: string
  type: string
  /** Frase con `___` donde va la opción. */
  prompt: string
  options: string[]
  answer: string
  /** Traducción de la frase completa, para el feedback. */
  translation: string
}

const DRILL_BANK: Record<string, DrillExercise[]> = {
  third_person_s: [
    { id: 'tps-1', type: 'third_person_s', prompt: 'She ___ to work every day.', options: ['go', 'goes', 'going'], answer: 'goes', translation: 'Ella va al trabajo todos los días.' },
    { id: 'tps-2', type: 'third_person_s', prompt: 'He ___ coffee in the morning.', options: ['drink', 'drinks', 'drinking'], answer: 'drinks', translation: 'Él toma café por la mañana.' },
    { id: 'tps-3', type: 'third_person_s', prompt: 'My brother ___ football on Sundays.', options: ['play', 'plays', 'playing'], answer: 'plays', translation: 'Mi hermano juega al fútbol los domingos.' },
    { id: 'tps-4', type: 'third_person_s', prompt: 'The bus ___ at eight.', options: ['leave', 'leaves', 'leaving'], answer: 'leaves', translation: 'El autobús sale a las ocho.' },
  ],
  word_order: [
    { id: 'wo-1', type: 'word_order', prompt: 'Elige la frase correcta:', options: ['I want a coffee.', 'Want I a coffee.', 'A coffee want I.'], answer: 'I want a coffee.', translation: 'Quiero un café.' },
    { id: 'wo-2', type: 'word_order', prompt: 'Where ___ ?', options: ['do you live', 'you live', 'live you'], answer: 'do you live', translation: '¿Dónde vives?' },
    { id: 'wo-3', type: 'word_order', prompt: 'Elige la frase correcta:', options: ['The film is very good.', 'Is very good the film.', 'Very good the film is.'], answer: 'The film is very good.', translation: 'La película es muy buena.' },
    { id: 'wo-4', type: 'word_order', prompt: 'Elige la frase correcta:', options: ['I speak English at work.', 'Speak I English at work.', 'English speak I at work.'], answer: 'I speak English at work.', translation: 'Hablo inglés en el trabajo.' },
  ],
  article: [
    { id: 'ar-1', type: 'article', prompt: 'I need ___ umbrella.', options: ['a', 'an', 'the'], answer: 'an', translation: 'Necesito un paraguas.' },
    { id: 'ar-2', type: 'article', prompt: 'She is ___ doctor.', options: ['a', 'an', 'the'], answer: 'a', translation: 'Ella es médica.' },
    { id: 'ar-3', type: 'article', prompt: '___ sun is bright today.', options: ['A', 'An', 'The'], answer: 'The', translation: 'El sol brilla hoy.' },
    { id: 'ar-4', type: 'article', prompt: 'He bought ___ new phone.', options: ['a', 'an', 'the'], answer: 'a', translation: 'Compró un teléfono nuevo.' },
  ],
  plural: [
    { id: 'pl-1', type: 'plural', prompt: 'Two ___ , please.', options: ['coffee', 'coffees', 'coffeees'], answer: 'coffees', translation: 'Dos cafés, por favor.' },
    { id: 'pl-2', type: 'plural', prompt: 'I have three ___ .', options: ['child', 'childs', 'children'], answer: 'children', translation: 'Tengo tres hijos.' },
    { id: 'pl-3', type: 'plural', prompt: 'There are many ___ here.', options: ['person', 'people', 'persons'], answer: 'people', translation: 'Hay mucha gente aquí.' },
    { id: 'pl-4', type: 'plural', prompt: 'She has two ___ .', options: ['cat', 'cats', 'cates'], answer: 'cats', translation: 'Ella tiene dos gatos.' },
  ],
  auxiliary: [
    { id: 'ax-1', type: 'auxiliary', prompt: '___ you like tea?', options: ['Do', 'Does', 'Are'], answer: 'Do', translation: '¿Te gusta el té?' },
    { id: 'ax-2', type: 'auxiliary', prompt: '___ she work here?', options: ['Do', 'Does', 'Is'], answer: 'Does', translation: '¿Trabaja ella aquí?' },
    { id: 'ax-3', type: 'auxiliary', prompt: 'I ___ not ready.', options: ['am', 'is', 'are'], answer: 'am', translation: 'No estoy listo.' },
    { id: 'ax-4', type: 'auxiliary', prompt: '___ they at home?', options: ['Is', 'Are', 'Do'], answer: 'Are', translation: '¿Están ellos en casa?' },
  ],
  past_tense: [
    { id: 'pt-1', type: 'past_tense', prompt: 'Yesterday I ___ to the park.', options: ['go', 'went', 'going'], answer: 'went', translation: 'Ayer fui al parque.' },
    { id: 'pt-2', type: 'past_tense', prompt: 'She ___ a great film last night.', options: ['see', 'saw', 'seen'], answer: 'saw', translation: 'Ella vio una gran película anoche.' },
    { id: 'pt-3', type: 'past_tense', prompt: 'We ___ at home last weekend.', options: ['was', 'were', 'are'], answer: 'were', translation: 'Estuvimos en casa el fin de semana pasado.' },
    { id: 'pt-4', type: 'past_tense', prompt: 'He ___ his keys yesterday.', options: ['lose', 'lost', 'losing'], answer: 'lost', translation: 'Él perdió sus llaves ayer.' },
  ],
  preposition: [
    { id: 'pr-1', type: 'preposition', prompt: "I'm good ___ English.", options: ['in', 'at', 'on'], answer: 'at', translation: 'Se me da bien el inglés.' },
    { id: 'pr-2', type: 'preposition', prompt: 'The book is ___ the table.', options: ['in', 'on', 'at'], answer: 'on', translation: 'El libro está sobre la mesa.' },
    { id: 'pr-3', type: 'preposition', prompt: 'I live ___ Madrid.', options: ['in', 'on', 'at'], answer: 'in', translation: 'Vivo en Madrid.' },
    { id: 'pr-4', type: 'preposition', prompt: 'We meet ___ Friday.', options: ['in', 'on', 'at'], answer: 'on', translation: 'Quedamos el viernes.' },
  ],
  other: [
    { id: 'ot-1', type: 'other', prompt: "I ___ like fish.", options: ["don't", "doesn't", 'not'], answer: "don't", translation: 'No me gusta el pescado.' },
    { id: 'ot-2', type: 'other', prompt: 'She can ___ very well.', options: ['swim', 'swims', 'to swim'], answer: 'swim', translation: 'Ella sabe nadar muy bien.' },
    { id: 'ot-3', type: 'other', prompt: 'There ___ a cat on the sofa.', options: ['is', 'are', 'be'], answer: 'is', translation: 'Hay un gato en el sofá.' },
  ],
}

/** Baraja una copia (Fisher-Yates). */
function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1))
    const tmp = copy[index]!
    copy[index] = copy[swap]!
    copy[swap] = tmp
  }
  return copy
}

/**
 * Arma una sesión de drills: dos ejercicios del tipo más fallado, uno del
 * segundo, y relleno variado si hiciera falta. Sin datos, sesión mixta.
 */
export function buildDrillSession(topTypes: string[], size = 3): DrillExercise[] {
  const picks: DrillExercise[] = []
  const used = new Set<string>()

  const take = (type: string, count: number) => {
    for (const item of shuffled(DRILL_BANK[type] ?? [])) {
      if (picks.length >= size || count <= 0) return
      if (used.has(item.id)) continue
      picks.push(item)
      used.add(item.id)
      count--
    }
  }

  const types = topTypes.length > 0 ? topTypes : shuffled(Object.keys(DRILL_BANK))
  if (types[0]) take(types[0], 2)
  if (types[1]) take(types[1], 1)
  for (const type of shuffled(Object.keys(DRILL_BANK))) {
    if (picks.length >= size) break
    take(type, size - picks.length)
  }

  return picks
}

/** Etiqueta legible de un tipo; los desconocidos caen en «otras reglas». */
export function errorTypeLabel(errorType: string): string {
  return ERROR_TYPE_BY_ID.get(errorType)?.label ?? 'otras reglas'
}
