/**
 * Genera misiones nuevas para un nivel CEFR y las inserta en PostgreSQL.
 *
 *   npm run missions:generate -w @vox/backend -- --level A1 --count 11
 *   npm run missions:generate -w @vox/backend -- --level A1 --count 4 --dry
 *
 * Es reutilizable para cualquier nivel: el modelo recibe las misiones que ya
 * existen (para no repetir situaciones) y el formato exacto del proyecto.
 * La salida va con esquema JSON, así que llega siempre parseable; lo que el
 * esquema no garantiza (campos vacíos, diálogo sin turnos, títulos repetidos)
 * se valida aquí antes de insertar.
 */
import { eq } from 'drizzle-orm'
import { completeChat, type JsonSchema } from '../src/lib/ai.ts'
import { db, sql } from '../src/db/client.ts'
import { missions } from '../src/db/schema.ts'
import { prewarmMissingContent } from './lib/prewarm-content.ts'
import type { CefrLevel } from '@vox/shared'

/** Duración por nivel, en segundos (la misma que usan las misiones actuales). */
const DURATION_BY_LEVEL: Record<CefrLevel, number> = { A1: 180, A2: 150, B1: 120, B2: 90, C1: 75 }

/** Cuántas misiones se piden al modelo por llamada; lotes pequeños evitan truncados. */
const BATCH_SIZE = 3

/** Margen de salida por nivel; B2 escribe diálogos largos. */
const MAX_TOKENS_BY_LEVEL: Record<CefrLevel, number> = { A1: 2200, A2: 2800, B1: 3400, B2: 4200, C1: 7000 }

/** Reintentos por lote antes de darlo por perdido. */
const MAX_BATCH_ATTEMPTS = 3

/** Lotes vacíos seguidos que se toleran antes de parar. */
const MAX_EMPTY_BATCHES = 3

const MISSION_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    missions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título corto en ESPAÑOL.' },
          description: { type: 'string', description: 'Una frase en ESPAÑOL.' },
          objective: {
            type: 'string',
            description:
              'Qué debe lograr el alumno, en ESPAÑOL, con detalles concretos (nombres, horas, precios, cantidades).',
          },
          scene_context: {
            type: 'string',
            description: 'Dónde está y con quién habla, en ESPAÑOL, 1-2 frases.',
          },
          character_name: {
            type: 'string',
            description: 'Nombre del personaje que interpreta la IA, en INGLÉS (p. ej. "Barista").',
          },
          expected_outcome_indicator: {
            type: 'string',
            description: 'Resumen del logro en INGLÉS, muy corto.',
          },
          example_conversation: {
            type: 'string',
            description:
              'Diálogo de ejemplo en INGLÉS, 4-6 líneas, alternando "Person:" y "User:".',
          },
        },
        required: [
          'title',
          'description',
          'objective',
          'scene_context',
          'character_name',
          'expected_outcome_indicator',
          'example_conversation',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['missions'],
  additionalProperties: false,
}

interface GeneratedMission {
  title: string
  description: string
  objective: string
  scene_context: string
  character_name: string
  expected_outcome_indicator: string
  example_conversation: string
}

/**
 * Cómo escala la dificultad por nivel. Cuanto más alto, más larga la
 * conversación, más variado el vocabulario y más cosas que resolver.
 */
const LEVEL_GUIDANCE: Record<CefrLevel, string> = {
  A1: `EASY, for a total beginner:
- 4-6 lines in the example conversation, very short (3-8 words each).
- Present simple and basic questions only. Everyday words (coffee, ticket, time).
- The student only has to say 2-3 short sentences; one single simple task.`,
  A2: `ELEMENTARY, one step above A1:
- 6-8 lines in the example conversation, sentences of 6-14 words.
- Past simple and basic future allowed; common everyday expressions.
- The student must handle 2-3 pieces of information (a date, a price, a place).`,
  B1: `INTERMEDIATE, noticeably harder than A2:
- 8-10 lines in the example conversation, sentences of 10-20 words.
- Varied tenses (past, present perfect, conditionals), opinions, explanations
  and reasons. Vocabulary beyond the basics (postpone, refund, neighbourhood...).
- The student must handle 3-4 details, justify something and ask follow-ups.`,
  C1: `ADVANCED, near-native:
- 12-14 lines, long sentences with subordinate clauses, inversion and cleft
  structures.
- Precise, low-frequency vocabulary (liability, discretionary, procurement,
  mitigate...), idioms and cultural references.
- The student must hedge, persuade, concede partially, read between the lines
  and defend a nuanced position under pressure.`,
  B2: `UPPER INTERMEDIATE, the hardest:
- 10-12 lines, sentences of 12-25 words with subordinate clauses.
- Idioms, phrasal verbs and precise vocabulary (reimbursement, inconvenience,
  binding agreement...). Nuanced arguments and polite but firm disagreement.
- The student must negotiate, complain or defend a position with conditions.`,
}

function buildPrompt(level: CefrLevel, count: number, existing: string[], topics: string | null): string {
  return `Create ${count} NEW English-learning missions for a CEFR ${level} student.

Each mission is a short real-life situation the student will play as a spoken/written roleplay with an AI character.

${LEVEL_GUIDANCE[level]}

FORMAT (respect it exactly):
- title, description, objective and scene_context: in SPANISH.
- character_name and example_conversation: in ENGLISH.
- objective must be concrete: include names, times, prices or quantities the student has to mention.
- example_conversation: one turn per line (real newline characters), 4-6 lines for A1 and more as the level rises, alternating "Person:" (the AI character) and "User:" (the student), in English. NEVER put the whole dialogue on a single line.
- character_name: the person the AI plays (waiter, clerk, neighbour, nurse...), never "Assistant".

ALREADY USED SITUATIONS, from every level (do NOT repeat these or close variants):
${existing.map(title => `- ${title}`).join('\n')}

Pick ${count} DIFFERENT everyday situations that an ${level} student would face.

${topics ? `FOCUS ON THESE SITUATIONS (they are the ones still missing):\n${topics}\n` : ''}
DOMAIN DIVERSITY (important): spread them across different areas — work, study,
health, travel, social, home, shops, services, money, technology. Do NOT make
them all complaints, refunds or negotiations: include a mix where the student
gives an opinion, explains a problem, makes a request, asks for information or
stands their ground. Vary the places and the people too.

Return ONLY the JSON.`
}

/**
 * El modelo a veces devuelve el diálogo entero en una sola línea
 * ("Person: ... User: ... Person: ..."). Se parte por los marcadores de
 * hablante en lugar de descartar la misión.
 */
function normalizeConversation(raw: string): string {
  const lines = raw.split('\n').map(line => line.trim()).filter(Boolean)
  if (lines.length >= 4) return raw

  const withBreaks = raw.replace(/\s+(?=[A-Za-z][A-Za-z ]{1,19}:\s)/g, '\n')
  const splitLines = withBreaks.split('\n').map(line => line.trim()).filter(Boolean)
  return splitLines.length > lines.length ? splitLines.join('\n') : raw
}

/** Comprueba lo que el esquema no garantiza antes de tocar la base de datos. */
function validate(missionsToCheck: GeneratedMission[], usedTitles: Set<string>): GeneratedMission[] {
  const valid: GeneratedMission[] = []

  for (const mission of missionsToCheck) {
    const fields = [
      mission.title,
      mission.description,
      mission.objective,
      mission.scene_context,
      mission.character_name,
      mission.expected_outcome_indicator,
      mission.example_conversation,
    ]
    if (fields.some(field => !field?.trim())) {
      console.warn(`  descartada "${mission.title ?? '?'}": tiene campos vacíos`)
      continue
    }

    const key = mission.title.trim().toLowerCase()
    if (usedTitles.has(key)) {
      console.warn(`  descartada "${mission.title}": título repetido`)
      continue
    }

    mission.example_conversation = normalizeConversation(mission.example_conversation)
    const lines = mission.example_conversation.split('\n').filter(line => line.trim())
    // Se acepta cualquier pareja de etiquetas (Person/User, Agent/Customer...):
    // lo que importa es que haya diálogo con dos voces.
    const speakers = new Set(
      lines
        .map(line => /^([^:]{2,20}):/.exec(line.trim())?.[1]?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value)),
    )
    if (lines.length < 4 || speakers.size < 2) {
      console.warn(
        `  descartada "${mission.title}": diálogo inválido (${lines.length} líneas, ${speakers.size} voces)`,
      )
      console.warn(`    ${lines.slice(0, 2).join(' / ').slice(0, 120)}`)
      continue
    }

    usedTitles.add(key)
    valid.push(mission)
  }

  return valid
}

function parseArgs(): { level: CefrLevel; count: number; dry: boolean; topics: string | null } {
  const args = process.argv.slice(2)
  const level = (args[args.indexOf('--level') + 1] ?? 'A1').toUpperCase() as CefrLevel
  const count = Number(args[args.indexOf('--count') + 1] ?? 4)
  const dry = args.includes('--dry')
  const topicsIndex = args.indexOf('--topics')
  const topics = topicsIndex === -1 ? null : (args[topicsIndex + 1] ?? null)

  if (!(level in DURATION_BY_LEVEL)) throw new Error(`Nivel no válido: ${level}`)
  if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error(`Cantidad no válida: ${count}`)

  return { level, count, dry, topics }
}

/** Siguiente id libre con el formato m-0NN del proyecto. */
function nextMissionId(existingIds: string[], offset: number): string {
  const numbers = existingIds
    .map(id => /^m-(\d+)$/.exec(id)?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number)
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1 + offset
  return `m-${String(next).padStart(3, '0')}`
}

async function main() {
  const { level, count, dry, topics } = parseArgs()

  const levelRows = await db.select().from(missions).where(eq(missions.cefr_level, level))
  const allRows = await db.select({ id: missions.id, title: missions.title }).from(missions)
  const usedTitles = new Set(allRows.map(row => row.title.trim().toLowerCase()))

  console.log(`Nivel ${level}: ${levelRows.length} misiones actuales. Se piden ${count} nuevas.`)

  const created: GeneratedMission[] = []
  let remaining = count
  let emptyBatches = 0

  while (remaining > 0) {
    const batch = Math.min(BATCH_SIZE, remaining)
    console.log(`\nGenerando lote de ${batch}...`)

    let valid: GeneratedMission[] = []

    // Un lote puede salir mal (formato, red): se reintenta sin perder lo ya
    // generado en los lotes anteriores.
    for (let attempt = 1; attempt <= MAX_BATCH_ATTEMPTS && valid.length === 0; attempt++) {
      try {
        const content = await completeChat({
          messages: [
            {
              role: 'user',
              // Se incluyen las ya creadas en esta ejecución: si no, cada lote
              // repite las situaciones de los anteriores.
              content: buildPrompt(level, batch, [
                ...allRows.map(row => row.title),
                ...created.map(mission => mission.title),
              ], topics),
            },
          ],
          schema: MISSION_SCHEMA,
          maxTokens: MAX_TOKENS_BY_LEVEL[level],
        })

        const parsed = JSON.parse(content) as { missions?: GeneratedMission[] }
        valid = validate(parsed.missions ?? [], usedTitles)
        if (valid.length === 0) console.warn(`  lote sin misiones válidas (intento ${attempt})`)
      } catch (error) {
        console.warn(`  fallo del lote (intento ${attempt}):`, (error as Error).message)
      }
    }

    if (valid.length === 0) {
      emptyBatches++
      // Tras varios lotes vacíos seguidos, el modelo no está cooperando.
      if (emptyBatches >= MAX_EMPTY_BATCHES) {
        console.warn('\nDemasiados lotes vacíos: se inserta lo que haya.')
        break
      }
      continue
    }

    created.push(...valid)
    remaining -= valid.length
  }

  if (created.length === 0) throw new Error('El modelo no devolvió ninguna misión utilizable')

  if (dry) {
    console.log('\n--- SIMULACRO (no se inserta nada) ---')
    for (const mission of created) {
      console.log(`\n${mission.title} [${level}]`)
      console.log(`  descripción: ${mission.description}`)
      console.log(`  objetivo:    ${mission.objective}`)
      console.log(`  escena:      ${mission.scene_context}`)
      console.log(`  personaje:   ${mission.character_name}`)
      console.log(`  logro:       ${mission.expected_outcome_indicator}`)
      console.log(`  diálogo:\n${mission.example_conversation.split('\n').map(l => '    ' + l).join('\n')}`)
    }
    return
  }

  const rows = created.map((mission, index) => ({
    id: nextMissionId(allRows.map(row => row.id), index),
    title: mission.title.trim(),
    description: mission.description.trim(),
    objective: mission.objective.trim(),
    scene_context: mission.scene_context.trim(),
    character_name: mission.character_name.trim(),
    expected_outcome_indicator: mission.expected_outcome_indicator.trim(),
    example_conversation: mission.example_conversation.trim(),
    cefr_level: level,
    base_duration_seconds: DURATION_BY_LEVEL[level],
  }))

  await db.insert(missions).values(rows)

  console.log(`\n${rows.length} misiones insertadas:`)
  for (const row of rows) console.log(`  ${row.id}  ${row.title}`)

  // El contenido generado (escena y vocabulario) se cachea en la base de
  // datos: precalentarlo aquí evita que el primer alumno espere. Con
  // `--no-prewarm` se omite (p. ej. si el proveedor de IA está caído).
  if (!process.argv.includes('--no-prewarm')) {
    console.log('\nPrecalentando escena y vocabulario de lo que falte…')
    await prewarmMissingContent()
  }
}

main()
  .catch(error => {
    console.error('Error generando misiones:', error)
    process.exitCode = 1
  })
  .finally(() => sql.end({ timeout: 5 }))
