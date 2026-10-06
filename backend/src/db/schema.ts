/**
 * Esquema PostgreSQL (Drizzle) de Letoura.
 *
 * Única fuente de verdad de la persistencia: ya no hay colecciones en JSON.
 * Las propiedades usan snake_case a propósito: es el nombre de columna real y
 * también el contrato JSON que consumen las rutas y el frontend
 * (`user.cefr_level`, `mission.scene_context`, `mission.base_duration_seconds`). Así las
 * filas devueltas por Drizzle se devuelven tal cual, sin capa de traducción,
 * que es donde suelen aparecer los campos olvidados.
 */
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import type { CefrLevel, IntroductionCharacter, IntroductionLine, MissionBackdrop, UserRole } from '@vox/shared'

/** Estados por los que pasa una respuesta de misión. */
export type ResponseStatus = 'submitted' | 'in_progress' | 'completed' | 'paused'

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    password_hash: text('password_hash').notNull(),
    role: text('role').notNull().$type<UserRole>(),
    full_name: text('full_name'),
    cefr_level: text('cefr_level').$type<CefrLevel | null>(),
    language_preference: text('language_preference').notNull().default('es'),
    created_at: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('users_email_key').on(t.email)],
)

export const missions = pgTable('missions', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  objective: text('objective'),
  scene_context: text('scene_context'),
  character_name: text('character_name'),
  expected_outcome_indicator: text('expected_outcome_indicator'),
  example_conversation: text('example_conversation'),
  cefr_level: text('cefr_level').notNull().$type<CefrLevel>(),
  base_duration_seconds: integer('base_duration_seconds'),
})

export const groups = pgTable(
  'groups',
  {
    id: text('id').primaryKey(),
    teacher_id: text('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // El código se genera con un bucle de comprobación en el handler; la
    // restricción única es la garantía real frente a carreras.
    access_code: text('access_code').notNull(),
    institution_name: text('institution_name'),
    parental_consent_confirmed: boolean('parental_consent_confirmed').notNull().default(false),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('groups_access_code_key').on(t.access_code),
    index('groups_teacher_idx').on(t.teacher_id),
  ],
)

export const group_members = pgTable(
  'group_members',
  {
    id: text('id').primaryKey(),
    group_id: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    student_id: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    joined_at: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('group_members_group_student_key').on(t.group_id, t.student_id),
    index('group_members_student_idx').on(t.student_id),
  ],
)

export const mission_assignments = pgTable(
  'mission_assignments',
  {
    id: text('id').primaryKey(),
    group_id: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    mission_id: text('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    assigned_by: text('assigned_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    due_date: date('due_date'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('mission_assignments_group_idx').on(t.group_id),
    index('mission_assignments_mission_idx').on(t.mission_id),
  ],
)

export const responses = pgTable(
  'responses',
  {
    id: text('id').primaryKey(),
    mission_id: text('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    student_id: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // La respuesta pertenece al alumno: si el grupo desaparece, se conserva.
    group_id: text('group_id').references(() => groups.id, { onDelete: 'set null' }),
    text_content: text('text_content').notNull(),
    input_mode: text('input_mode'),
    transcript: text('transcript'),
    time_taken_seconds: integer('time_taken_seconds'),
    submitted_at: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    // Nullable a propósito: las respuestas históricas no siempre lo traían.
    status: text('status').$type<ResponseStatus>(),
  },
  (t) => [
    index('responses_student_submitted_idx').on(t.student_id, t.submitted_at),
    index('responses_mission_idx').on(t.mission_id),
    index('responses_group_idx').on(t.group_id),
  ],
)

export const evaluations = pgTable(
  'evaluations',
  {
    id: text('id').primaryKey(),
    response_id: text('response_id')
      .notNull()
      .references(() => responses.id, { onDelete: 'cascade' }),
    comprehensibility_score: integer('comprehensibility_score').notNull(),
    grammar_score: integer('grammar_score').notNull(),
    lexical_richness_score: integer('lexical_richness_score').notNull(),
    judgment: text('judgment').notNull().$type<'ADVANCE' | 'PAUSE'>(),
    feedback_text: text('feedback_text').notNull(),
    detected_structures: jsonb('detected_structures').$type<string[]>().notNull().default([]),
    transcript: text('transcript'),
    evaluated_at: timestamp('evaluated_at', { withTimezone: true }).notNull().defaultNow(),
    /** Puntos de gamificación; hoy siempre null (ver README, deuda conocida). */
    xp_awarded: integer('xp_awarded'),
  },
  // Una respuesta se evalúa una sola vez: el código busca la evaluación por
  // `response_id` asumiendo unicidad.
  (t) => [uniqueIndex('evaluations_response_key').on(t.response_id)],
)

export const weekly_aggregates = pgTable(
  'weekly_aggregates',
  {
    id: text('id').primaryKey(),
    student_id: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    group_id: text('group_id').references(() => groups.id, { onDelete: 'set null' }),
    week_start_date: date('week_start_date').notNull(),
    total_writing_time_seconds: integer('total_writing_time_seconds').notNull().default(0),
    missions_completed: integer('missions_completed').notNull().default(0),
    avg_comprehensibility: doublePrecision('avg_comprehensibility'),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // Un único agregado por alumno y semana; el handler hace upsert sobre esta clave.
  (t) => [
    uniqueIndex('weekly_aggregates_student_week_key').on(t.student_id, t.week_start_date),
    index('weekly_aggregates_group_idx').on(t.group_id),
  ],
)

export const mission_introductions = pgTable(
  'mission_introductions',
  {
    id: text('id').primaryKey(),
    mission_id: text('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    scene_title: text('scene_title').notNull(),
    scene_description: text('scene_description').notNull(),
    characters: jsonb('characters').$type<IntroductionCharacter[]>().notNull(),
    lines: jsonb('lines').$type<IntroductionLine[]>().notNull(),
    useful_expressions: jsonb('useful_expressions').$type<string[]>().notNull(),
    /**
     * Dirección de arte del fondo de la escena. Nula en las introducciones
     * anteriores a la función: el frontend entonces usa su respaldo por
     * palabras clave.
     */
    backdrop: jsonb('backdrop').$type<MissionBackdrop | null>(),
    /** Modelo que la generó: sirve para saber qué hay que regenerar. */
    generated_by: text('generated_by').notNull(),
    /** Cada regeneración suma 1; no se guardan versiones antiguas. */
    version: integer('version').notNull().default(1),
    is_published: boolean('is_published').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // Una introducción por misión: la generación es cara y se comparte entre
  // todos los alumnos.
  (t) => [uniqueIndex('mission_introductions_mission_key').on(t.mission_id)],
)

/** Frase de ejemplo de una palabra, con su traducción. */
export interface WordExample {
  en: string
  es: string
}

/**
 * Ficha de una palabra consultada (hover en la escena o el chat).
 *
 * La genera la IA una sola vez por palabra y se comparte entre todos los
 * alumnos: sin esta caché, cada hover costaría una llamada al modelo.
 */
export const word_lookups = pgTable(
  'word_lookups',
  {
    id: text('id').primaryKey(),
    /** Palabra normalizada (minúsculas, sin puntuación): clave de la caché. */
    word: text('word').notNull(),
    translation: text('translation').notNull(),
    /** 'verb', 'noun', 'adjective'...; decide si hay conjugación que mostrar. */
    part_of_speech: text('part_of_speech').notNull(),
    /** Formas verbales en inglés; null cuando la palabra no es un verbo. */
    present: text('present'),
    past: text('past'),
    past_participle: text('past_participle'),
    examples: jsonb('examples').$type<WordExample[]>().notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('word_lookups_word_key').on(t.word)],
)

/** Vocabulario personal: palabras que el alumno decidió guardar. */
export const saved_words = pgTable(
  'saved_words',
  {
    id: text('id').primaryKey(),
    student_id: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // La ficha es compartida; si algún día se borra, la palabra guardada cae.
    word_lookup_id: text('word_lookup_id')
      .notNull()
      .references(() => word_lookups.id, { onDelete: 'cascade' }),
    /** Frase donde la encontró; ayuda a recordar el sentido en contexto. */
    context: text('context'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Guardar dos veces la misma palabra no crea dos entradas.
    uniqueIndex('saved_words_student_word_key').on(t.student_id, t.word_lookup_id),
    index('saved_words_student_idx').on(t.student_id, t.created_at),
  ],
)

/** Una palabra clave de la misión: se estudia y luego se empareja. */
export interface VocabularyWord {
  /** Palabra en inglés, normalizada a minúsculas. */
  word: string
  /** Traducción al español. */
  translation: string
  /** Frase de ejemplo en inglés, usada en esta situación. */
  example: string
  /** Traducción al español de la frase de ejemplo. */
  example_translation: string
}

/**
 * Vocabulario clave de una misión: las 7 palabras que el alumno repasa entre
 * la escena narrativa y la conversación. Se genera una vez por misión y se
 * comparte entre todos los alumnos, como la introducción.
 */
export const mission_vocabulary = pgTable(
  'mission_vocabulary',
  {
    id: text('id').primaryKey(),
    mission_id: text('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    words: jsonb('words').$type<VocabularyWord[]>().notNull(),
    generated_by: text('generated_by').notNull(),
    /** Cada regeneración suma 1; no se guardan versiones antiguas. */
    version: integer('version').notNull().default(1),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('mission_vocabulary_mission_key').on(t.mission_id)],
)

export const narrative_states = pgTable(
  'narrative_states',
  {
    id: text('id').primaryKey(),
    // Sin estas FK los endpoints de estado narrativo aceptaban cualquier
    // string y dejaban filas huérfanas (se detectaron 2 antes de añadirlas).
    student_id: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mission_id: text('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    group_id: text('group_id').references(() => groups.id, { onDelete: 'set null' }),
    state: text('state').notNull(),
    character_reaction: text('character_reaction'),
    scene_position: integer('scene_position'),
    updated_at: timestamp('updated_at', { withTimezone: true }),
  },
  // submit() localiza el registro por (student_id, mission_id) y lo inserta si
  // no existe: sin esta restricción las escrituras concurrentes duplicarían filas.
  (t) => [
    uniqueIndex('narrative_states_student_mission_key').on(t.student_id, t.mission_id),
    index('narrative_states_student_idx').on(t.student_id, t.state),
  ],
)
