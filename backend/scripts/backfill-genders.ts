/**
 * Rellena el género de los personajes de las escenas ya guardadas.
 *
 *   npm run genders:backfill -w @vox/backend
 *   npm run genders:backfill -w @vox/backend -- --dry
 *
 * Las escenas anteriores a la función no traen `gender` en sus personajes, así
 * que el avatar no podía pintarse acorde al nombre. Este script pide SOLO el
 * género (una llamada corta por escena) y completa el campo sin tocar nada más.
 * Idempotente: cuando todas lo tienen, no hace nada.
 */
import { eq } from 'drizzle-orm'
import { db, sql } from '../src/db/client.ts'
import { mission_introductions } from '../src/db/schema.ts'
import type { IntroductionCharacter } from '@vox/shared'
import { completeChat } from '../src/lib/ai.ts'
import { GENDERS_SCHEMA, buildGendersPrompt } from '../src/modules/introductions/prompts.ts'

const dry = process.argv.includes('--dry')

const rows = await sql<
  Array<{
    id: string
    scene_description: string
    characters: IntroductionCharacter[]
    title: string
    scene_context: string | null
  }>
>`
  SELECT i.id, i.scene_description, i.characters, m.title, m.scene_context
  FROM mission_introductions i
  JOIN missions m ON m.id = i.mission_id
  WHERE EXISTS (
    SELECT 1 FROM jsonb_array_elements(i.characters) caracter
    WHERE caracter->>'gender' IS NULL
  )
  ORDER BY i.mission_id
`

console.log(`${rows.length} escenas sin género${dry ? ' (dry)' : ''}`)

let updated = 0
let failed = 0

for (const row of rows) {
  try {
    const content = await completeChat({
      messages: [
        {
          role: 'user',
          content: buildGendersPrompt({
            title: row.title,
            sceneContext: row.scene_context,
            sceneDescription: row.scene_description,
            characters: row.characters.map(character => ({
              id: character.id,
              name: character.name,
              role: character.role,
            })),
          }),
        },
      ],
      schema: GENDERS_SCHEMA,
      maxTokens: 200,
    })

    const parsed = JSON.parse(content) as { characters?: Array<{ id?: string; gender?: string }> }
    const byId = new Map(
      (parsed.characters ?? []).map(entry => [entry.id, entry.gender] as const),
    )
    const withGender = row.characters.map(character => ({
      ...character,
      gender:
        character.gender ??
        (byId.get(character.id) === 'male' || byId.get(character.id) === 'female'
          ? (byId.get(character.id) as 'male' | 'female')
          : undefined),
    }))

    console.log(
      `  · ${row.title}: ${withGender.map(c => `${c.name}=${c.gender ?? '—'}`).join(', ')}`,
    )

    if (!dry) {
      await db
        .update(mission_introductions)
        .set({ characters: withGender, updated_at: new Date() })
        .where(eq(mission_introductions.id, row.id))
    }
    updated += 1
  } catch (err) {
    failed += 1
    console.warn(`  ✗ ${row.title}: ${(err as Error).message}`)
  }
}

console.log(`\n${dry ? '[dry] ' : ''}${updated} escenas ${dry ? 'se actualizarían' : 'actualizadas'}${failed ? `, ${failed} fallos` : ''}`)
process.exit(0)
