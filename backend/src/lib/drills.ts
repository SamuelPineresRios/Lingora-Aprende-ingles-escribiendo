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
  /** Por qué esa opción es la correcta y cómo se usa la regla. */
  explanation: string
}

const DRILL_BANK: Record<string, DrillExercise[]> = {
  third_person_s: [
    { id: 'tps-1', type: 'third_person_s', prompt: 'She ___ to work every day.', options: ['go', 'goes', 'going'], answer: 'goes', translation: 'Ella va al trabajo todos los días.' , explanation: 'Con he/she/it el verbo lleva -s en presente: she goes. La forma sin -s (go) es para I/you/we/they.'},
    { id: 'tps-2', type: 'third_person_s', prompt: 'He ___ coffee in the morning.', options: ['drink', 'drinks', 'drinking'], answer: 'drinks', translation: 'Él toma café por la mañana.' , explanation: 'He drinks: la tercera persona singular añade -s al verbo.'},
    { id: 'tps-3', type: 'third_person_s', prompt: 'My brother ___ football on Sundays.', options: ['play', 'plays', 'playing'], answer: 'plays', translation: 'Mi hermano juega al fútbol los domingos.' , explanation: 'My brother = he, así que plays. Con verbos terminados en vocal + y solo se añade -s (la y no cambia).'},
    { id: 'tps-4', type: 'third_person_s', prompt: 'The bus ___ at eight.', options: ['leave', 'leaves', 'leaving'], answer: 'leaves', translation: 'El autobús sale a las ocho.' , explanation: 'The bus = it: la tercera persona en presente siempre lleva -s (leaves).'},
  ],
  word_order: [
    { id: 'wo-1', type: 'word_order', prompt: 'Elige la frase correcta:', options: ['I want a coffee.', 'Want I a coffee.', 'A coffee want I.'], answer: 'I want a coffee.', translation: 'Quiero un café.' , explanation: 'En inglés el orden es sujeto + verbo + objeto: I want a coffee. "Want I" es el orden del español traducido palabra a palabra.'},
    { id: 'wo-2', type: 'word_order', prompt: 'Where ___ ?', options: ['do you live', 'you live', 'live you'], answer: 'do you live', translation: '¿Dónde vives?' , explanation: 'En preguntas: auxiliar (do/does) + sujeto + verbo. Where do you live?'},
    { id: 'wo-3', type: 'word_order', prompt: 'Elige la frase correcta:', options: ['The film is very good.', 'Is very good the film.', 'Very good the film is.'], answer: 'The film is very good.', translation: 'La película es muy buena.' , explanation: 'El sujeto va delante del verbo: The film is very good. Invertir el orden solo se hace en preguntas.'},
    { id: 'wo-4', type: 'word_order', prompt: 'Elige la frase correcta:', options: ['I speak English at work.', 'Speak I English at work.', 'English speak I at work.'], answer: 'I speak English at work.', translation: 'Hablo inglés en el trabajo.' , explanation: 'Sujeto + verbo + complemento: I speak English. Nunca se invierte como en español ("hablo yo inglés").'},
  ],
  article: [
    { id: 'ar-1', type: 'article', prompt: 'I need ___ umbrella.', options: ['a', 'an', 'the'], answer: 'an', translation: 'Necesito un paraguas.' , explanation: 'Antes de sonido vocal se usa an: an umbrella. "a" es para sonido consonante (a table).'},
    { id: 'ar-2', type: 'article', prompt: 'She is ___ doctor.', options: ['a', 'an', 'the'], answer: 'a', translation: 'Ella es médica.' , explanation: 'a doctor: "doctor" empieza con sonido consonante /d/, así que va a.'},
    { id: 'ar-3', type: 'article', prompt: '___ sun is bright today.', options: ['A', 'An', 'The'], answer: 'The', translation: 'El sol brilla hoy.' , explanation: 'Con algo único o ya conocido se usa the: the sun (solo hay un sol).'},
    { id: 'ar-4', type: 'article', prompt: 'He bought ___ new phone.', options: ['a', 'an', 'the'], answer: 'a', translation: 'Compró un teléfono nuevo.' , explanation: 'a new phone: es la primera vez que se menciona y "new" suena consonante → a.'},
  ],
  plural: [
    { id: 'pl-1', type: 'plural', prompt: 'Two ___ , please.', options: ['coffee', 'coffees', 'coffeees'], answer: 'coffees', translation: 'Dos cafés, por favor.' , explanation: 'Los sustantivos contables forman el plural con -s: two coffees.'},
    { id: 'pl-2', type: 'plural', prompt: 'I have three ___ .', options: ['child', 'childs', 'children'], answer: 'children', translation: 'Tengo tres hijos.' , explanation: 'Child es irregular: su plural es children, nunca "childs".'},
    { id: 'pl-3', type: 'plural', prompt: 'There are many ___ here.', options: ['person', 'people', 'persons'], answer: 'people', translation: 'Hay mucha gente aquí.' , explanation: 'Person también es irregular: el plural normal es people.'},
    { id: 'pl-4', type: 'plural', prompt: 'She has two ___ .', options: ['cat', 'cats', 'cates'], answer: 'cats', translation: 'Ella tiene dos gatos.' , explanation: 'Plural regular: cat → cats. Se añade -es solo tras s, x, ch o sh.'},
  ],
  auxiliary: [
    { id: 'ax-1', type: 'auxiliary', prompt: '___ you like tea?', options: ['Do', 'Does', 'Are'], answer: 'Do', translation: '¿Te gusta el té?' , explanation: 'Con I/you/we/they las preguntas empiezan con Do: Do you like tea?'},
    { id: 'ax-2', type: 'auxiliary', prompt: '___ she work here?', options: ['Do', 'Does', 'Is'], answer: 'Does', translation: '¿Trabaja ella aquí?' , explanation: 'Con he/she/it se usa Does + verbo en forma base: Does she work here?'},
    { id: 'ax-3', type: 'auxiliary', prompt: 'I ___ not ready.', options: ['am', 'is', 'are'], answer: 'am', translation: 'No estoy listo.' , explanation: 'El verbo to be con I es am: I am not ready.'},
    { id: 'ax-4', type: 'auxiliary', prompt: '___ they at home?', options: ['Is', 'Are', 'Do'], answer: 'Are', translation: '¿Están ellos en casa?' , explanation: 'Con they el verbo to be es are: Are they at home?'},
  ],
  past_tense: [
    { id: 'pt-1', type: 'past_tense', prompt: 'Yesterday I ___ to the park.', options: ['go', 'went', 'going'], answer: 'went', translation: 'Ayer fui al parque.' , explanation: 'Go es irregular: su pasado es went, no "goed".'},
    { id: 'pt-2', type: 'past_tense', prompt: 'She ___ a great film last night.', options: ['see', 'saw', 'seen'], answer: 'saw', translation: 'Ella vio una gran película anoche.' , explanation: 'See es irregular: el pasado es saw. "seen" es el participio (va con have/has).'},
    { id: 'pt-3', type: 'past_tense', prompt: 'We ___ at home last weekend.', options: ['was', 'were', 'are'], answer: 'were', translation: 'Estuvimos en casa el fin de semana pasado.' , explanation: 'Con we el pasado de to be es were: we were. "was" es para I/he/she/it.'},
    { id: 'pt-4', type: 'past_tense', prompt: 'He ___ his keys yesterday.', options: ['lose', 'lost', 'losing'], answer: 'lost', translation: 'Él perdió sus llaves ayer.' , explanation: 'Lose es irregular: pasado lost. Con "yesterday" toca pasado simple.'},
  ],
  preposition: [
    { id: 'pr-1', type: 'preposition', prompt: "I'm good ___ English.", options: ['in', 'at', 'on'], answer: 'at', translation: 'Se me da bien el inglés.' , explanation: 'Con "good" para habilidades se usa siempre at: good at English, good at maths. Es una combinación fija, no "good in".'},
    { id: 'pr-2', type: 'preposition', prompt: 'The book is ___ the table.', options: ['in', 'on', 'at'], answer: 'on', translation: 'El libro está sobre la mesa.' , explanation: 'on the table: sobre una superficie. "in" es dentro de algo y "at" para un punto concreto.'},
    { id: 'pr-3', type: 'preposition', prompt: 'I live ___ Madrid.', options: ['in', 'on', 'at'], answer: 'in', translation: 'Vivo en Madrid.' , explanation: 'Con ciudades y países se usa in: in Madrid, in Spain.'},
    { id: 'pr-4', type: 'preposition', prompt: 'We meet ___ Friday.', options: ['in', 'on', 'at'], answer: 'on', translation: 'Quedamos el viernes.' , explanation: 'Con días de la semana se usa on: on Friday. "in" es para meses y años (in July) y "at" para horas (at 7).'},
  ],
  other: [
    { id: 'ot-1', type: 'other', prompt: "I ___ like fish.", options: ["don't", "doesn't", 'not'], answer: "don't", translation: 'No me gusta el pescado.' , explanation: 'La negación con I/you/we/they es don\'t: I don\'t like fish. "doesn\'t" es para he/she/it.'},
    { id: 'ot-2', type: 'other', prompt: 'She can ___ very well.', options: ['swim', 'swims', 'to swim'], answer: 'swim', translation: 'Ella sabe nadar muy bien.' , explanation: 'Tras can el verbo va en forma base, sin to ni -s: she can swim.'},
    { id: 'ot-3', type: 'other', prompt: 'There ___ a cat on the sofa.', options: ['is', 'are', 'be'], answer: 'is', translation: 'Hay un gato en el sofá.' , explanation: 'There is con singular: There is a cat. "There are" se usa con plural.'},
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
