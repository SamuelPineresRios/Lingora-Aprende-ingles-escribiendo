/**
 * Prompt de generación de la introducción narrativa.
 *
 * Parte de los datos de la misión y, si existe, de su conversación de ejemplo
 * (`missions.example_conversation`) para no inventar una situación distinta.
 */
import type { CefrLevel } from '@vox/shared'
import { BACKDROP_KINDS, BACKDROP_LIGHTS, BACKDROP_STYLES } from '@vox/shared'
import type { JsonSchema } from '../../lib/ai.ts'

/** Complexidad de la escena según el nivel; la introducción debe seguirlo. */
const CEFR_SCENE_GUIDANCE: Record<CefrLevel | 'C1', string> = {
  A1: 'Very short lines (3-6 words), everyday vocabulary, present simple, basic questions.',
  A2: 'Short lines (4-10 words), simple descriptions, basic past and future, common everyday expressions.',
  B1: 'Natural lines with varied tenses, opinions, explanations and experiences.',
  B2: 'More developed lines, some idiomatic expressions, arguments and nuances.',
  C1: 'Fluent and natural lines, specialised vocabulary where it fits, cultural nuances, advanced structures.',
}

export interface IntroductionSource {
  missionId: string
  title: string
  description: string | null
  objective: string | null
  sceneContext: string | null
  characterName: string | null
  cefrLevel: CefrLevel
  exampleConversation: string | null
  expectedOutcome: string | null
}

/** A qué lugar corresponde cada tipo de fondo, para que el modelo no dude. */
const BACKDROP_KIND_GUIDE =
  'office = oficina, despacho, sala de reuniones; shop = tienda, supermercado, librería, mercado; restaurant = restaurante, café, bar, pub; street = calle, plaza, exterior urbano; transport = estación, aeropuerto, parada de autobús, tren, taxi; campus = universidad, instituto, biblioteca, colegio; home = casa, apartamento, Airbnb; gym = gimnasio, centro deportivo; park = parque, jardín, playa; hotel = hotel, alojamiento, recepción; health = farmacia, hospital, consulta médica; services = banco, oficina de cambio, atención al cliente, suscripciones; generic = cualquier otro lugar.'

/** Esquema de la dirección de arte del fondo. */
export const BACKDROP_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    kind: {
      type: 'string',
      enum: [...BACKDROP_KINDS],
      description: 'Tipo de lugar de la escena.',
    },
    style: {
      type: 'string',
      enum: [...BACKDROP_STYLES],
      description:
        "Tratamiento visual: 'flat' (formas planas y limpias), 'diorama' (capas con volumen, estilo maqueta) o 'blueprint' (líneas técnicas sobre fondo oscuro).",
    },
    light: {
      type: 'string',
      enum: [...BACKDROP_LIGHTS],
      description: 'Momento del día de la escena.',
    },
    palette: {
      type: 'array',
      items: { type: 'string', description: 'Color hex #rrggbb.' },
      description:
        'Exactamente tres colores hex: el primero tiñe el cielo o el fondo, el segundo la media distancia y el tercero el acento (objetos y luces).',
    },
    props: {
      type: 'array',
      items: { type: 'string', description: 'Detalle corto en inglés, p. ej. "skyline".' },
      description: 'Hasta 4 detalles que caracterizan el lugar: skyline, plants, lamps, rain…',
    },
  },
  required: ['kind', 'style', 'light', 'palette'],
  additionalProperties: false,
}
/** Esquema de la introducción que devuelve el modelo. */
export const INTRODUCTION_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    scene_title: {
      type: 'string',
      description: 'Título corto de la escena en español, p. ej. "En la agencia de viajes".',
    },
    scene_description: {
      type: 'string',
      description:
        'Cómo es el entorno y el ambiente, en español, 1-2 frases. Se usa como fondo de la escena.',
    },
    characters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', enum: ['A', 'B'], description: 'Referencia para las líneas.' },
          name: { type: 'string', description: 'Nombre del personaje.' },
          role: { type: 'string', description: 'Su papel en la escena, en español, p. ej. "Camarero".' },
          emoji: { type: 'string', description: 'Un emoji que lo represente.' },
          played_by: {
            type: 'string',
            enum: ['ai', 'student'],
            description: "'ai' lo interpretará el asistente; 'student' es el papel que asumirá el alumno.",
          },
          gender: {
            type: 'string',
            enum: ['male', 'female'],
            description: "Género del personaje, coherente con su nombre y su papel.",
          },
        },
        required: ['id', 'name', 'role', 'emoji', 'played_by', 'gender'],
        additionalProperties: false,
      },
    },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          speaker: { type: 'string', enum: ['A', 'B'] },
          text: { type: 'string', description: 'Frase del personaje, en inglés.' },
          translation: { type: 'string', description: 'La misma frase traducida al español.' },
        },
        required: ['speaker', 'text', 'translation'],
        additionalProperties: false,
      },
    },
    useful_expressions: {
      type: 'array',
      items: { type: 'string', description: 'Expresión en inglés para la misión real.' },
      description: 'Entre 3 y 5 expresiones que el alumno necesitará.',
    },
    backdrop: BACKDROP_SCHEMA,
  },
  required: ['scene_title', 'scene_description', 'characters', 'lines', 'useful_expressions', 'backdrop'],
  additionalProperties: false,
}

export function buildIntroductionPrompt(source: IntroductionSource): string {
  const guidance = CEFR_SCENE_GUIDANCE[source.cefrLevel] ?? CEFR_SCENE_GUIDANCE.B1

  return `Create the OPENING SCENE of a learning mission, as a short dialogue between TWO characters that the student will watch before playing it themselves.

MISSION DATA
- Title: ${source.title}
- Description: ${source.description ?? '(none)'}
- Objective (what the student must achieve): ${source.objective ?? '(none)'}
- Scene: ${source.sceneContext ?? '(none)'}
- Character the AI will play: ${source.characterName ?? '(unnamed)'}
- CEFR level: ${source.cefrLevel}
- Expected outcome: ${source.expectedOutcome ?? '(none)'}

${source.exampleConversation ? `REFERENCE CONVERSATION provided by the teacher (follow its situation and the kind of phrases it uses, but you may improve the wording):\n${source.exampleConversation}` : 'There is no reference conversation: invent the scene from the mission data above.'}

RULES
1. The objective is the complete case: use its names, places, numbers, options and constraints. Do not invent conflicting facts or ask the student for case data that the objective already provides.
1a. Exactly TWO characters: one with played_by "ai" and one with played_by "student".
1b. Give each character a gender ("male" or "female") that fits their name and role. If the name is ambiguous (Alex, Sam, Jordan…), pick the most likely one for that role and stay consistent with it.
2. The character played_by "ai" MUST be named exactly "${source.characterName ?? 'Assistant'}". Never rename that character.
3. The character played_by "student" is a natural counterpart (customer, passenger, patient...). Never name it after the student.
4. 4 to 6 lines in total, alternating speakers, starting with the character played_by "ai" greeting the other.
5. The dialogue must END at the exact point where the student takes over: the character played_by "ai" has just asked something the student would answer. Do NOT resolve the objective.
6. Every line carries its Spanish translation, matching the English exactly in meaning (natural Spanish, not word by word).
7. useful_expressions: 3 to 5 phrases the student will actually need to achieve the objective. They must fit this mission, not be generic.
8. Level of complexity: ${guidance}
9. Write for a ${source.cefrLevel} student: the scene prepares, it does not test.
10. backdrop: art direction for the background of THIS mission. Pick the kind that matches the place (${[...BACKDROP_KINDS].join(', ')}). Guide: ${BACKDROP_KIND_GUIDE} Pick the style that matches the tone: "blueprint" for tech, finance or formal settings; "diorama" for everyday, warm places; "flat" for clean minimal scenes. Pick the light (day, sunset, night) that the scene suggests. The palette must be THREE hex colors (#rrggbb): the first for the sky or base, the second for the mid distance, the third as an accent (objects and lights); they must feel like the place and time of day. Add up to 4 props (short English words) with the details that make it recognizable, e.g. "skyline", "plants", "rain".
11. Return ONLY valid JSON.

Language note: the scene_title, scene_description, character roles and translations are in SPANISH; the lines' text and useful_expressions are in ENGLISH.`
}

/**
 * Prompt suelto para pedir SOLO el fondo de una escena ya existente.
 *
 * Lo usa el script que rellena el `backdrop` de las introducciones cacheadas
 * antes de que existiera la función; comparte con la introducción el esquema y
 * las mismas reglas de estilo.
 */
export function buildBackdropPrompt(source: {
  title: string
  sceneContext: string | null
  sceneDescription: string
}): string {
  return `Choose the BACKGROUND of a language-learning mission as art direction. Return ONLY valid JSON.

MISSION
- Title: ${source.title}
- Scene: ${source.sceneContext ?? '(none)'}
- Scene description: ${source.sceneDescription}

RULES
1. kind: the place of the scene, one of: ${[...BACKDROP_KINDS].join(', ')}. Guide: ${BACKDROP_KIND_GUIDE}
2. style: "blueprint" for tech, finance or formal settings; "diorama" for everyday, warm places; "flat" for clean minimal scenes. Pick the one that matches the tone.
3. light: day, sunset or night, as the scene suggests.
4. palette: THREE hex colors (#rrggbb): the first for the sky or base, the second for the mid distance, the third as an accent (objects and lights). They must feel like this place and time of day.
5. props: up to 4 short English words with the details that make it recognizable (e.g. "skyline", "plants", "rain").`
}

/** Esquema suelto: solo el género de los personajes de una escena ya guardada. */
export const GENDERS_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    characters: {
      type: 'array',
      description: 'Un elemento por personaje, con su id y su género.',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', enum: ['A', 'B'] },
          gender: { type: 'string', enum: ['male', 'female'] },
        },
        required: ['id', 'gender'],
        additionalProperties: false,
      },
    },
  },
  required: ['characters'],
  additionalProperties: false,
}

/**
 * Prompt suelto para pedir SOLO el género de una escena ya existente.
 *
 * Lo usa el script que rellena las introducciones cacheadas antes de que
 * existiera el campo; comparte con la introducción la misma regla.
 */
export function buildGendersPrompt(source: {
  title: string
  sceneContext: string | null
  sceneDescription: string
  characters: Array<{ id: string; name: string; role: string }>
}): string {
  return `Assign a gender to each character of this language-learning scene. Return ONLY valid JSON.

MISSION
- Title: ${source.title}
- Scene: ${source.sceneContext ?? '(none)'}
- Scene description: ${source.sceneDescription}

CHARACTERS
${source.characters.map(character => `- id "${character.id}": ${character.name} (${character.role})`).join('\n')}

RULES
1. gender must be "male" or "female".
2. It must fit the character's name and role. If the name is ambiguous (Alex, Sam, Jordan…), pick the most likely one for that role.
3. Return exactly one entry per character id.`
}
