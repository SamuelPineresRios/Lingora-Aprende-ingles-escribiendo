/**
 * Tests de la tienda y las monedas.
 *
 * Lo importante: que el saldo sume pase + movimientos, que no se pueda comprar
 * sin fondos ni repetir un artículo no consumible, que los escudos se apilen y
 * que solo el propio alumno gaste sus monedas.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { createApp } from '../src/app.ts'
import { db } from '../src/db/client.ts'
import { coin_ledger, evaluations, responses } from '../src/db/schema.ts'
import { coinsForXp, TIER_XP } from '../src/lib/season.ts'
import { resetDb } from './helpers/db.ts'
import { createMission, signupActor, type Actor } from './helpers/fixtures.ts'

const app = createApp()

/** Alumno con XP de sobra para probar la tienda. */
async function richStudent(app_: ReturnType<typeof createApp>): Promise<{ student: Actor; coins: number }> {
  const student = await signupActor(app_, 'student')
  const mission = await createMission({ cefr_level: 'B1' })
  const responseId = randomUUID()
  const xp = TIER_XP * 12

  await db.insert(responses).values({
    id: responseId,
    mission_id: mission,
    student_id: student.id,
    text_content: 'texto',
    input_mode: 'text',
    transcript: null,
    time_taken_seconds: 600,
    submitted_at: new Date(),
    status: 'completed',
  })
  await db.insert(evaluations).values({
    id: randomUUID(),
    response_id: responseId,
    comprehensibility_score: 80,
    grammar_score: 80,
    lexical_richness_score: 80,
    judgment: 'ADVANCE',
    feedback_text: 'texto',
    detected_structures: [],
    transcript: null,
    evaluated_at: new Date(),
    xp_awarded: xp,
  })

  return { student, coins: coinsForXp(xp) }
}

beforeEach(async () => {
  await resetDb()
})

describe('GET /api/students/:id/store', () => {
  it('exige sesión y respeta el dueño (el docente puede mirar, no gastar)', async () => {
    const { student } = await richStudent(app)
    const otro = await signupActor(app, 'student')
    const teacher = await signupActor(app, 'teacher')

    expect((await request(app).get(`/api/students/${student.id}/store`)).status).toBe(401)
    expect((await otro.agent.get(`/api/students/${student.id}/store`)).status).toBe(403)
    expect((await teacher.agent.get(`/api/students/${student.id}/store`)).status).toBe(200)
    expect((await teacher.agent.post(`/api/students/${student.id}/store/purchase`).send({ item_id: 'titulo-constante' })).status).toBe(403)
  })

  it('el saldo son las monedas del pase y el catálogo trae el estado', async () => {
    const { student, coins } = await richStudent(app)

    const res = await student.agent.get(`/api/students/${student.id}/store`)

    expect(res.status).toBe(200)
    expect(res.body.balance).toBe(coins)
    expect(res.body.shields).toBe(0)
    expect(res.body.loadout).toEqual({ frame_id: null, title_ids: [], theme_id: null })
    expect(res.body.items.length).toBeGreaterThanOrEqual(12)
    expect(res.body.items.every((item: { owned: boolean; equipped: boolean }) => !item.owned && !item.equipped)).toBe(true)
  })
})

describe('POST /api/students/:id/store/purchase', () => {
  it('compra, descuenta y no permite repetir un no consumible', async () => {
    const { student, coins } = await richStudent(app)

    const primera = await student.agent
      .post(`/api/students/${student.id}/store/purchase`)
      .send({ item_id: 'titulo-constante' })

    expect(primera.status).toBe(200)
    expect(primera.body.balance).toBe(coins - 150)
    const titulo = primera.body.items.find((item: { id: string }) => item.id === 'titulo-constante')
    expect(titulo.owned).toBe(true)
    expect(titulo.equipped).toBe(false)

    const repetida = await student.agent
      .post(`/api/students/${student.id}/store/purchase`)
      .send({ item_id: 'titulo-constante' })
    expect(repetida.status).toBe(400)
    expect(repetida.body.error).toBe('Ya tienes ese artículo')
  })

  it('los escudos se acumulan y bajan el saldo', async () => {
    const { student, coins } = await richStudent(app)

    await student.agent.post(`/api/students/${student.id}/store/purchase`).send({ item_id: 'escudo-racha' })
    const res = await student.agent.post(`/api/students/${student.id}/store/purchase`).send({ item_id: 'escudo-racha' })

    expect(res.status).toBe(200)
    expect(res.body.shields).toBe(2)
    expect(res.body.balance).toBe(coins - 300)
  })

  it('sin fondos no compra, y un artículo inexistente da 404', async () => {
    const { student } = await richStudent(app)

    const caro = await student.agent
      .post(`/api/students/${student.id}/store/purchase`)
      .send({ item_id: 'marco-neon' })
    // 415 monedas del pase no llegan a las 500 del marco neón.
    expect(caro.status).toBe(400)
    expect(caro.body.error).toBe('No tienes monedas suficientes')

    const fantasma = await student.agent
      .post(`/api/students/${student.id}/store/purchase`)
      .send({ item_id: 'no-existe' })
    expect(fantasma.status).toBe(404)
  })
})

describe('POST /api/students/:id/store/equip', () => {
  it('equipa lo comprado y rechaza lo que no se tiene o no se equipa', async () => {
    const { student } = await richStudent(app)

    const sinComprar = await student.agent
      .post(`/api/students/${student.id}/store/equip`)
      .send({ item_id: 'titulo-explorador' })
    expect(sinComprar.status).toBe(403)

    await student.agent.post(`/api/students/${student.id}/store/purchase`).send({ item_id: 'titulo-explorador' })
    const equipado = await student.agent
      .post(`/api/students/${student.id}/store/equip`)
      .send({ item_id: 'titulo-explorador' })

    expect(equipado.status).toBe(200)
    expect(equipado.body.loadout.title_ids).toEqual(['titulo-explorador'])
    const titulo = equipado.body.items.find((item: { id: string }) => item.id === 'titulo-explorador')
    expect(titulo.equipped).toBe(true)

    // Volver a equipar el mismo título lo quita (son acumulables y alternan).
    const quitado = await student.agent
      .post(`/api/students/${student.id}/store/equip`)
      .send({ item_id: 'titulo-explorador' })
    expect(quitado.body.loadout.title_ids).toEqual([])

    await student.agent.post(`/api/students/${student.id}/store/purchase`).send({ item_id: 'escudo-racha' })
    const escudo = await student.agent
      .post(`/api/students/${student.id}/store/equip`)
      .send({ item_id: 'escudo-racha' })
    expect(escudo.status).toBe(400)
  })

  it('acumula hasta 3 títulos y el cuarto se rechaza', async () => {
    const { student } = await richStudent(app)
    await db.insert(coin_ledger).values({
      id: randomUUID(),
      student_id: student.id,
      amount: 1000,
      reason: 'quest',
      ref: 'test',
    })

    const titulos = ['titulo-constante', 'titulo-explorador', 'titulo-madrugador', 'titulo-noctambulo']
    for (const itemId of titulos) {
      await student.agent.post(`/api/students/${student.id}/store/purchase`).send({ item_id: itemId })
    }

    await student.agent.post(`/api/students/${student.id}/store/equip`).send({ item_id: titulos[0] })
    await student.agent.post(`/api/students/${student.id}/store/equip`).send({ item_id: titulos[1] })
    const tres = await student.agent
      .post(`/api/students/${student.id}/store/equip`)
      .send({ item_id: titulos[2] })

    expect(tres.body.loadout.title_ids).toEqual(['titulo-constante', 'titulo-explorador', 'titulo-madrugador'])
    expect(tres.body.items.filter((item: { kind: string; equipped: boolean }) => item.kind === 'title' && item.equipped)).toHaveLength(3)

    const cuarto = await student.agent
      .post(`/api/students/${student.id}/store/equip`)
      .send({ item_id: titulos[3] })
    expect(cuarto.status).toBe(400)
    expect(cuarto.body.error).toContain('3 títulos')

    // Al quitar uno, entra el cuarto.
    await student.agent.post(`/api/students/${student.id}/store/equip`).send({ item_id: titulos[0] })
    const entra = await student.agent
      .post(`/api/students/${student.id}/store/equip`)
      .send({ item_id: titulos[3] })
    expect(entra.body.loadout.title_ids).toEqual(['titulo-explorador', 'titulo-madrugador', 'titulo-noctambulo'])
  })
})
