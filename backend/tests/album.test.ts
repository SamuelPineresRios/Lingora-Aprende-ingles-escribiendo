/**
 * Tests del álbum de escenas.
 *
 * Lo importante: que liste todas las misiones como cartas (con su personaje y
 * escena), que completar una misión la desbloquee, que las colecciones por
 * nivel cuadren y que completar un nivel dé su medalla como premio.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createApp } from '../src/app.ts'
import { db } from '../src/db/client.ts'
import { mission_introductions, narrative_states } from '../src/db/schema.ts'
import { resetDb } from './helpers/db.ts'
import { createMission, signupActor, type Actor } from './helpers/fixtures.ts'

const app = createApp()

/** Marca misiones como completadas (la misma fuente que usan las medallas). */
async function completeMissions(student: Actor, missionIds: string[]): Promise<void> {
  await db.insert(narrative_states).values(
    missionIds.map(missionId => ({
      id: randomUUID(),
      student_id: student.id,
      mission_id: missionId,
      state: 'completed',
      updated_at: new Date(),
    })),
  )
}

/** Escena con personaje de IA, para comprobar de dónde salen los datos. */
async function seedIntroduction(missionId: string, sceneTitle: string, characterName: string): Promise<void> {
  await db.insert(mission_introductions).values({
    id: randomUUID(),
    mission_id: missionId,
    scene_title: sceneTitle,
    scene_description: 'Una escena de prueba.',
    characters: [
      { id: 'A', name: characterName, role: 'Personaje', emoji: '☕', gender: 'female', played_by: 'ai' },
      { id: 'B', name: 'Tú', role: 'Tu papel', emoji: '🧑', gender: 'male', played_by: 'student' },
    ],
    lines: [{ speaker: 'A', text: 'Hello!', translation: '¡Hola!' }],
    useful_expressions: [],
    backdrop: null,
    generated_by: 'test',
    version: 1,
    is_published: true,
  })
}

beforeEach(async () => {
  await resetDb()
})

describe('GET /api/students/:id/album', () => {
  it('un alumno nuevo tiene todo bloqueado, con las colecciones a cero', async () => {
    const ana = await signupActor(app, 'student')
    await createMission({ id: 'm-alb-1', cefr_level: 'A1' })
    await createMission({ id: 'm-alb-2', cefr_level: 'A1' })
    await createMission({ id: 'm-alb-3', cefr_level: 'B1' })

    const res = await ana.agent.get(`/api/students/${ana.id}/album`)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(3)
    expect(res.body.unlocked).toBe(0)
    expect(res.body.characters.every((card: { unlocked: boolean }) => !card.unlocked)).toBe(true)
    const a1 = res.body.collections.find((collection: { level: string }) => collection.level === 'A1')
    expect(a1).toMatchObject({ total: 2, unlocked: 0 })
    expect(a1.medal.earned).toBe(false)
  })

  it('completar una misión desbloquea su carta y usa la escena y el personaje', async () => {
    const ana = await signupActor(app, 'student')
    await createMission({ id: 'm-alb-4', title: 'Pedir un café', cefr_level: 'A1' })
    await createMission({ id: 'm-alb-5', title: 'Sin escena', cefr_level: 'A1' })
    await seedIntroduction('m-alb-4', 'La cafetería', 'Barista')
    await completeMissions(ana, ['m-alb-4'])

    const res = await ana.agent.get(`/api/students/${ana.id}/album`)

    expect(res.body.unlocked).toBe(1)
    const carta = res.body.characters.find((card: { mission_id: string }) => card.mission_id === 'm-alb-4')
    expect(carta).toMatchObject({
      unlocked: true,
      scene_title: 'La cafetería',
      character_name: 'Barista',
      emoji: '☕',
      gender: 'female',
    })

    // La misión sin escena cae al nombre del personaje de la misión y queda bloqueada.
    const sinEscena = res.body.characters.find((card: { mission_id: string }) => card.mission_id === 'm-alb-5')
    expect(sinEscena).toMatchObject({ unlocked: false, scene_title: null })
  })

  it('completar todo un nivel da su medalla como premio', async () => {
    const ana = await signupActor(app, 'student')
    await createMission({ id: 'm-alb-6', cefr_level: 'A1' })
    await createMission({ id: 'm-alb-7', cefr_level: 'A1' })
    await createMission({ id: 'm-alb-8', cefr_level: 'A2' })

    await completeMissions(ana, ['m-alb-6', 'm-alb-7'])

    const res = await ana.agent.get(`/api/students/${ana.id}/album`)

    const a1 = res.body.collections.find((collection: { level: string }) => collection.level === 'A1')
    expect(a1).toMatchObject({ unlocked: 2, total: 2 })
    expect(a1.medal).toMatchObject({ id: 'dios-a1', earned: true })

    const a2 = res.body.collections.find((collection: { level: string }) => collection.level === 'A2')
    expect(a2.medal.earned).toBe(false)
  })

  it('respeta permisos: solo el alumno o sus docentes', async () => {
    const ana = await signupActor(app, 'student')
    const luis = await signupActor(app, 'student')
    const teacher = await signupActor(app, 'teacher')

    expect((await luis.agent.get(`/api/students/${ana.id}/album`)).status).toBe(403)
    expect((await teacher.agent.get(`/api/students/${ana.id}/album`)).status).toBe(200)
  })
})
