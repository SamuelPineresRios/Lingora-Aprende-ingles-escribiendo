/**
 * Tests de las rutas por objetivo.
 *
 * Lo importante: que cada alumno vea solo la rebanada de su nivel, que el
 * orden curado se respete, que el progreso salga de lo completado (misma
 * fuente que el álbum y las medallas), que las rutas sin misiones del nivel
 * se oculten y que el endpoint respete permisos.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createApp } from '../src/app.ts'
import { db } from '../src/db/client.ts'
import { narrative_states } from '../src/db/schema.ts'
import { LEARNING_PATHS } from '../src/lib/learning-paths.ts'
import { resetDb } from './helpers/db.ts'
import { createMission, signupActor, type Actor } from './helpers/fixtures.ts'

const app = createApp()

/** Marca una misión como completada. */
async function completeMission(student: Actor, missionId: string): Promise<void> {
  await db.insert(narrative_states).values({
    id: randomUUID(),
    student_id: student.id,
    mission_id: missionId,
    state: 'completed',
    updated_at: new Date(),
  })
}

beforeEach(async () => {
  await resetDb()
})

describe('catálogo de rutas', () => {
  it('cada ruta tiene misiones y sin duplicados', () => {
    expect(LEARNING_PATHS.length).toBeGreaterThanOrEqual(4)
    for (const path of LEARNING_PATHS) {
      expect(path.missions.length).toBeGreaterThanOrEqual(4)
      expect(new Set(path.missions).size).toBe(path.missions.length)
      expect(path.missions.every(id => /^m-\d+$/.test(id))).toBe(true)
    }
  })
})

describe('GET /api/students/:id/paths', () => {
  it('el alumno A1 solo ve la rebanada A1 de cada ruta', async () => {
    const ana = await signupActor(app, 'student', { cefr_level: 'A1' })
    await createMission({ id: 'm-001', title: 'Pedir direcciones', cefr_level: 'A1' })
    await createMission({ id: 'm-008', title: 'Comprar un billete de autobús', cefr_level: 'A1' })
    await createMission({ id: 'm-016', title: 'Reservar un vuelo', cefr_level: 'A2' })
    await createMission({ id: 'm-050', title: 'Debatir sobre una película', cefr_level: 'B2' })

    const res = await ana.agent.get(`/api/students/${ana.id}/paths`)

    expect(res.status).toBe(200)
    expect(res.body.level).toBe('A1')
    // Solo la ruta de viajes tiene misiones A1 sembradas.
    expect(res.body.paths.map((path: { id: string }) => path.id)).toEqual(['ruta-viajes'])

    const viajes = res.body.paths[0]
    expect(viajes.total).toBe(2)
    expect(viajes.completed).toBe(0)
    expect(viajes.missions.map((mission: { mission_id: string }) => mission.mission_id)).toEqual(['m-001', 'm-008'])
    expect(viajes.missions.every((mission: { status: string }) => mission.status === 'pending')).toBe(true)
  })

  it('el progreso sale de las misiones completadas', async () => {
    const ana = await signupActor(app, 'student', { cefr_level: 'A1' })
    await createMission({ id: 'm-001', title: 'Pedir direcciones', cefr_level: 'A1' })
    await createMission({ id: 'm-008', title: 'Comprar un billete de autobús', cefr_level: 'A1' })
    await completeMission(ana, 'm-001')

    const res = await ana.agent.get(`/api/students/${ana.id}/paths`)

    const viajes = res.body.paths[0]
    expect(viajes.completed).toBe(1)
    expect(viajes.missions[0]).toMatchObject({ mission_id: 'm-001', status: 'completed' })
    expect(viajes.missions[1]).toMatchObject({ mission_id: 'm-008', status: 'pending' })
  })

  it('un alumno A2 ve sus rutas de A2 (viajes y trabajo)', async () => {
    const luis = await signupActor(app, 'student', { cefr_level: 'A2' })
    await createMission({ id: 'm-016', title: 'Reservar un vuelo', cefr_level: 'A2' })
    await createMission({ id: 'm-027', title: 'Pedir un día libre', cefr_level: 'A2' })
    await createMission({ id: 'm-001', title: 'Pedir direcciones', cefr_level: 'A1' })

    const res = await luis.agent.get(`/api/students/${luis.id}/paths`)

    const ids = res.body.paths.map((path: { id: string }) => path.id).sort()
    expect(ids).toEqual(['ruta-trabajo', 'ruta-viajes'])
    const viajes = res.body.paths.find((path: { id: string }) => path.id === 'ruta-viajes')
    expect(viajes.missions.map((mission: { mission_id: string }) => mission.mission_id)).toEqual(['m-016'])
    const trabajo = res.body.paths.find((path: { id: string }) => path.id === 'ruta-trabajo')
    expect(trabajo.missions.map((mission: { mission_id: string }) => mission.mission_id)).toEqual(['m-027'])
  })

  it('respeta permisos: solo el alumno o sus docentes', async () => {
    const ana = await signupActor(app, 'student')
    const luis = await signupActor(app, 'student')
    const teacher = await signupActor(app, 'teacher')

    expect((await luis.agent.get(`/api/students/${ana.id}/paths`)).status).toBe(403)
    expect((await teacher.agent.get(`/api/students/${ana.id}/paths`)).status).toBe(200)
  })
})
