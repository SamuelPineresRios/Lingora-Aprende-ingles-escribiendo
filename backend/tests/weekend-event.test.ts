/**
 * Tests del evento de fin de semana.
 *
 * Lo importante: que la ventana sea sábado/domingo (en la clave de día del
 * alumno), que la escena sea la del nivel, que completarla doble el XP y
 * entregue el marco exclusivo una sola vez, y que ese marco no se pueda
 * comprar en la tienda.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createApp } from '../src/app.ts'
import { db } from '../src/db/client.ts'
import { purchases } from '../src/db/schema.ts'
import { WEEKEND_EVENT, eventMissionFor, isWeekendKey } from '../src/lib/weekend-event.ts'
import { applyWeekendEventBonus, weekendEventState } from '../src/modules/events/service.ts'
import { resetDb } from './helpers/db.ts'
import { createMission, signupActor } from './helpers/fixtures.ts'

const app = createApp()

/** Un viernes, un sábado y un domingo de la misma semana. */
const FRIDAY = '2026-10-16'
const SATURDAY = '2026-10-17'
const SUNDAY = '2026-10-18'

beforeEach(async () => {
  await resetDb()
})

describe('ventana del evento', () => {
  it('solo sábado y domingo son fin de semana', () => {
    expect(isWeekendKey(FRIDAY)).toBe(false)
    expect(isWeekendKey(SATURDAY)).toBe(true)
    expect(isWeekendKey(SUNDAY)).toBe(true)
    expect(isWeekendKey('2026-10-19')).toBe(false)
  })

  it('cada nivel tiene su escena y los desconocidos ninguna', () => {
    expect(eventMissionFor('A1')).toBe('m-004')
    expect(eventMissionFor('C1')).toBe('m-071')
    expect(eventMissionFor('A0')).toBeNull()
    expect(eventMissionFor(null)).toBeNull()
  })
})

describe('estado del evento', () => {
  it('en fin de semana está activo con la escena del nivel', async () => {
    const ana = await signupActor(app, 'student', { cefr_level: 'A1' })
    await createMission({ id: 'm-004', title: 'Conocer a alguien en una fiesta', cefr_level: 'A1' })

    const state = await weekendEventState(ana.id, SATURDAY)

    expect(state.active).toBe(true)
    expect(state.mission?.id).toBe('m-004')
    expect(state.starts_at).toBe(SATURDAY)
    expect(state.ends_at).toBe(SUNDAY)
    expect(state.xp_percent).toBe(200)
    expect(state.frame.owned).toBe(false)
  })

  it('en semana apunta al próximo sábado', async () => {
    const ana = await signupActor(app, 'student', { cefr_level: 'A1' })
    await createMission({ id: 'm-004', title: 'Conocer a alguien en una fiesta', cefr_level: 'A1' })

    const state = await weekendEventState(ana.id, FRIDAY)

    expect(state.active).toBe(false)
    expect(state.starts_at).toBe(SATURDAY)
  })

  it('el marco aparece como conseguido tras ganarlo', async () => {
    const ana = await signupActor(app, 'student', { cefr_level: 'A1' })
    await createMission({ id: 'm-004', title: 'Conocer a alguien en una fiesta', cefr_level: 'A1' })
    await db.insert(purchases).values({ id: 'p-evento', student_id: ana.id, item_id: WEEKEND_EVENT.frame_id })

    const state = await weekendEventState(ana.id, SATURDAY)
    expect(state.frame.owned).toBe(true)
  })
})

describe('bonus del evento al completar', () => {
  it('dobla el XP y entrega el marco una sola vez', async () => {
    const ana = await signupActor(app, 'student', { cefr_level: 'A1' })

    expect(await applyWeekendEventBonus(ana.id, 'm-004', 'A1', SATURDAY, 100)).toBe(200)
    expect(await applyWeekendEventBonus(ana.id, 'm-004', 'A1', SATURDAY, 100)).toBe(200)

    const owned = await db.select().from(purchases).where(eq(purchases.student_id, ana.id))
    expect(owned).toHaveLength(1)
    expect(owned[0]?.item_id).toBe(WEEKEND_EVENT.frame_id)
  })

  it('no aplica en semana ni a misiones que no son la escena', async () => {
    const ana = await signupActor(app, 'student', { cefr_level: 'A1' })

    expect(await applyWeekendEventBonus(ana.id, 'm-004', 'A1', FRIDAY, 100)).toBe(100)
    expect(await applyWeekendEventBonus(ana.id, 'm-001', 'A1', SATURDAY, 100)).toBe(100)

    const owned = await db.select().from(purchases).where(eq(purchases.student_id, ana.id))
    expect(owned).toHaveLength(0)
  })
})

describe('API y tienda', () => {
  it('el estado se sirve por API y respeta permisos', async () => {
    const ana = await signupActor(app, 'student', { cefr_level: 'A1' })
    const luis = await signupActor(app, 'student')
    await createMission({ id: 'm-004', title: 'Conocer a alguien en una fiesta', cefr_level: 'A1' })

    const res = await ana.agent.get(`/api/students/${ana.id}/event?tz=UTC`)
    expect(res.status).toBe(200)
    expect(res.body.mission.id).toBe('m-004')
    expect(res.body.xp_percent).toBe(200)
    expect(res.body.frame.id).toBe(WEEKEND_EVENT.frame_id)

    expect((await luis.agent.get(`/api/students/${ana.id}/event?tz=UTC`)).status).toBe(403)
  })

  it('el marco exclusivo no se puede comprar y aparece en el catálogo', async () => {
    const ana = await signupActor(app, 'student')

    const store = await ana.agent.get(`/api/students/${ana.id}/store`)
    const frame = store.body.items.find((item: { id: string }) => item.id === WEEKEND_EVENT.frame_id)
    expect(frame).toMatchObject({ event: true, owned: false })

    const buy = await ana.agent
      .post(`/api/students/${ana.id}/store/purchase`)
      .send({ item_id: WEEKEND_EVENT.frame_id })
    expect(buy.status).toBe(400)
    expect(buy.body.error).toBe('Se gana en el evento de fin de semana')
  })
})
