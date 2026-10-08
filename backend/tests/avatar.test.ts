/**
 * Tests del avatar personalizable.
 *
 * Lo importante: que el registro regale un skin base con el seed del id (el
 * personaje no cambia al renombrar), que solo el dueño pueda editar su avatar
 * y que el backend rechace cualquier pieza fuera del catálogo compartido.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.ts'
import { baseAvatar, AVATAR_TOPS } from '@vox/shared'
import { resetDb } from './helpers/db.ts'
import { signupActor } from './helpers/fixtures.ts'

const app = createApp()

/** Avatar válido de prueba, con un par de piezas cambiadas. */
function avatarPayload(seed: string) {
  return {
    ...baseAvatar(seed),
    top: 'mohawk',
    topColor: 'e63946',
    skinColor: '8d5524',
    outfit: 'jacket',
    shirtColor: 'ffffff',
    jacketColor: '3b82f6',
    pantsColor: '1e293b',
    shoesColor: 'f472b6',
    hatColor: '111827',
    eyes: 'happy',
    eyebrows: 'flat',
    mouth: 'grin',
    nose: 'block',
    cheeks: 'blush',
    glasses: 'round',
    beard: null,
  }
}

beforeEach(async () => {
  await resetDb()
})

describe('avatar del alumno', () => {
  it('el registro guarda un skin base con el seed del id', async () => {
    const student = await signupActor(app, 'student')

    const avatar = baseAvatar(student.id)
    const res = await student.agent.get('/api/auth/me')

    expect(res.status).toBe(200)
    expect(res.body.user.avatar).toBeTruthy()
    expect(res.body.user.avatar.seed).toBe(student.id)
    expect(AVATAR_TOPS).toContain(res.body.user.avatar.top)
    expect(res.body.user.avatar.skinColor).toMatch(/^[0-9a-f]{6}$/)
    // El base es determinista: el mismo id devuelve el mismo personaje.
    expect(res.body.user.avatar).toEqual(avatar)
  })

  it('el dueño edita su avatar y persiste', async () => {
    const student = await signupActor(app, 'student')
    const payload = avatarPayload(student.id)

    const patch = await student.agent.patch(`/api/students/${student.id}/avatar`).send(payload)
    expect(patch.status).toBe(200)
    expect(patch.body.user.avatar.top).toBe('mohawk')
    expect(patch.body.user.avatar.glasses).toBe('round')

    const me = await student.agent.get('/api/auth/me')
    expect(me.body.user.avatar.top).toBe('mohawk')
    expect(me.body.user.avatar.skinColor).toBe('8d5524')
    expect(me.body.user.avatar.beard).toBeNull()
  })

  it('otro alumno o un docente no pueden tocar el avatar ajeno', async () => {
    const ana = await signupActor(app, 'student')
    const luis = await signupActor(app, 'student')
    const teacher = await signupActor(app, 'teacher')

    const payload = avatarPayload(ana.id)
    expect((await luis.agent.patch(`/api/students/${ana.id}/avatar`).send(payload)).status).toBe(403)
    expect((await teacher.agent.patch(`/api/students/${ana.id}/avatar`).send(payload)).status).toBe(403)
  })

  it('sin sesión no se edita', async () => {
    const student = await signupActor(app, 'student')
    const response = await request(app)
      .patch(`/api/students/${student.id}/avatar`)
      .send(avatarPayload(student.id))
    // El guard global de la API exige sesión.
    expect([401, 403]).toContain(response.status)
  })

  it('rechaza piezas fuera del catálogo, hex inválidos y campos desconocidos', async () => {
    const student = await signupActor(app, 'student')
    const url = `/api/students/${student.id}/avatar`

    const malTop = await student.agent.patch(url).send({ ...avatarPayload(student.id), top: 'dreadlocks' })
    expect(malTop.status).toBe(400)
    expect(malTop.body.error).toContain('top')

    const malColor = await student.agent.patch(url).send({ ...avatarPayload(student.id), skinColor: 'azul' })
    expect(malColor.status).toBe(400)

    const extra = await student.agent.patch(url).send({ ...avatarPayload(student.id), superpoder: true })
    expect(extra.status).toBe(400)
    expect(extra.body.error).toContain('superpoder')

    // Un 400 no debe haber tocado el avatar guardado.
    const me = await student.agent.get('/api/auth/me')
    expect(me.body.user.avatar).toEqual(baseAvatar(student.id))
  })

  it('el docente no recibe skin base (solo los alumnos)', async () => {
    const teacher = await signupActor(app, 'teacher')
    const me = await teacher.agent.get('/api/auth/me')
    expect(me.body.user.avatar).toBeNull()
  })
})
