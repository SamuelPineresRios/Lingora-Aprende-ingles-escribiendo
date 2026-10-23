/**
 * Micro-lecciones de gramática por tipo de error.
 *
 * El chat clasifica el error (`error_type`); con esa clave el alumno recibe
 * una regla corta y dos ejemplos. Es contenido estático: sin coste de IA y
 * siempre disponible, también sin red.
 */
export interface GrammarLesson {
  title: string
  rule: string
  examples: Array<{ en: string; es: string }>
}

export const GRAMMAR_LESSONS: Record<string, GrammarLesson> = {
  third_person_s: {
    title: 'La -s de tercera persona',
    rule: 'Con he, she o it el verbo en presente lleva -s. Con I, you, we y they, no.',
    examples: [
      { en: 'She goes to work by bus.', es: 'Ella va al trabajo en autobús.' },
      { en: 'He drinks coffee every morning.', es: 'Él toma café cada mañana.' },
    ],
  },
  word_order: {
    title: 'El orden de la frase',
    rule: 'En inglés el orden es sujeto + verbo + complemento. En preguntas: auxiliar + sujeto + verbo.',
    examples: [
      { en: 'I want a coffee.', es: 'Quiero un café.' },
      { en: 'Where do you live?', es: '¿Dónde vives?' },
    ],
  },
  article: {
    title: 'Los artículos a / an / the',
    rule: 'a antes de sonido consonante, an antes de vocal, y the para algo conocido o único.',
    examples: [
      { en: 'I need an umbrella.', es: 'Necesito un paraguas.' },
      { en: 'The film was great.', es: 'La película fue genial.' },
    ],
  },
  plural: {
    title: 'El plural',
    rule: 'El plural regular añade -s (o -es tras s, x, ch, sh). Hay irregulares como children y people.',
    examples: [
      { en: 'Two coffees, please.', es: 'Dos cafés, por favor.' },
      { en: 'Three children are playing.', es: 'Tres niños están jugando.' },
    ],
  },
  auxiliary: {
    title: 'Do / does y am / is / are',
    rule: 'Preguntas y negativas con do/does; el verbo to be se conjuga con am/is/are.',
    examples: [
      { en: 'Do you like tea?', es: '¿Te gusta el té?' },
      { en: "She doesn't work here.", es: 'Ella no trabaja aquí.' },
    ],
  },
  past_tense: {
    title: 'El pasado simple',
    rule: 'Los verbos regulares terminan en -ed; muchos comunes son irregulares (went, saw, lost).',
    examples: [
      { en: 'Yesterday I went to the park.', es: 'Ayer fui al parque.' },
      { en: 'She saw a film last night.', es: 'Ella vio una película anoche.' },
    ],
  },
  preposition: {
    title: 'Las preposiciones',
    rule: 'in para espacios cerrados y ciudades, on para superficies y días, at para horas y combinaciones fijas.',
    examples: [
      { en: 'I live in Madrid.', es: 'Vivo en Madrid.' },
      { en: 'We meet on Friday at seven.', es: 'Quedamos el viernes a las siete.' },
    ],
  },
  other: {
    title: 'Revisa la regla',
    rule: 'Comprueba la concordancia y la forma del verbo antes de enviar.',
    examples: [
      { en: "I don't like fish.", es: 'No me gusta el pescado.' },
      { en: 'There is a cat on the sofa.', es: 'Hay un gato en el sofá.' },
    ],
  },
}

export function lessonFor(errorType: string | null | undefined): GrammarLesson {
  return (errorType && GRAMMAR_LESSONS[errorType]) || GRAMMAR_LESSONS.other!
}
