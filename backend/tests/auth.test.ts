/**
 * Tests de integración del módulo de autenticación.
 *
 * Cubren el contrato HTTP completo (status, cuerpo, cookie) contra una base de
 * datos PostgreSQL real: son la red de seguridad de la migración desde Next.js.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.ts'
import { resetDb } from './helpers/db.ts'

const app = createApp()

const VALID_STUDENT = {
  email: 'alumno@lingora.test',
  password: 'contrasena-segura',
  full_name: 'Alumno de Prueba',
  role: 'student',
  cefr_level: 'A2',
}

/** Extrae la cabecera Set-Cookie de la sesión; falla si no está. */
function sessionCookie(response: request.Response): string {
  const header = response.headers['set-cookie']
  const cookies = Array.isArray(header) ? header : [header]
  const cookie = cookies.find(value => value?.startsWith('speak_session='))
  if (!cookie) throw new Error('La respuesta no incluye la cookie speak_session')
  return cookie
}

beforeEach(async () => {
  await resetDb()
})

describe('POST /api/auth/signup', () => {
  it('crea la cuenta, responde 201 y emite la cookie de sesión', async () => {
    const res = await request(app).post('/api/auth/signup').send(VALID_STUDENT)

    expect(res.status).toBe(201)
    expect(res.body.user).toMatchObject({
      email: 'alumno@lingora.test',
      role: 'student',
      full_name: 'Alumno de Prueba',
      cefr_level: 'A2',
    })
    expect(res.body.user).not.toHaveProperty('password_hash')
    expect(res.body.user.id).toEqual(expect.any(String))

    const cookie = sessionCookie(res)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
    // 7 días exactos, el desajuste segundos/milisegundos dejaría 10 minutos.
    expect(cookie).toContain('Max-Age=604800')
  })

  it('normaliza el email a minúsculas y sin espacios', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ ...VALID_STUDENT, email: '  Alumno@Lingora.Test  ' })

    expect(res.status).toBe(201)
    expect(res.body.user.email).toBe('alumno@lingora.test')
  })

  it('rechaza un email duplicado con 409', async () => {
    await request(app).post('/api/auth/signup').send(VALID_STUDENT)
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ ...VALID_STUDENT, email: 'ALUMNO@LINGORA.TEST' })

    expect(res.status).toBe(409)
    expect(res.body).toEqual({ error: 'Ya existe una cuenta con este email' })
  })

  it('exige todos los campos', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'x@vox.test' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Todos los campos son requeridos' })
  })

  it('exige una contraseña de al menos 8 caracteres', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ ...VALID_STUDENT, password: 'corta' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'La contraseña debe tener mínimo 8 caracteres' })
  })

  it('rechaza roles fuera de student/teacher', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ ...VALID_STUDENT, role: 'admin' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Rol no válido' })
  })

  it('rechaza niveles CEFR desconocidos', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ ...VALID_STUDENT, cefr_level: 'C2' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Nivel CEFR no válido' })
  })

  it('aplica B1 por defecto a los estudiantes sin nivel', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ ...VALID_STUDENT, email: 'sin-nivel@vox.test', cefr_level: undefined })

    expect(res.status).toBe(201)
    expect(res.body.user.cefr_level).toBe('B1')
  })

  it('ignora el nivel CEFR en cuentas de profesor', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ ...VALID_STUDENT, email: 'profe@vox.test', role: 'teacher', cefr_level: 'B2' })

    expect(res.status).toBe(201)
    expect(res.body.user.role).toBe('teacher')
    expect(res.body.user.cefr_level).toBeNull()
  })
})

describe('POST /api/auth/login', () => {
  it('inicia sesión con credenciales válidas', async () => {
    await request(app).post('/api/auth/signup').send(VALID_STUDENT)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: VALID_STUDENT.email, password: VALID_STUDENT.password })

    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe('alumno@lingora.test')
    expect(res.body.user).not.toHaveProperty('password_hash')
    expect(sessionCookie(res)).toContain('HttpOnly')
  })

  it('acepta el email con mayúsculas y espacios', async () => {
    await request(app).post('/api/auth/signup').send(VALID_STUDENT)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '  ALUMNO@Lingora.test ', password: VALID_STUDENT.password })

    expect(res.status).toBe(200)
  })

  it('rechaza una contraseña incorrecta con 401', async () => {
    await request(app).post('/api/auth/signup').send(VALID_STUDENT)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: VALID_STUDENT.email, password: 'otra-contrasena' })

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'Email o contraseña incorrectos' })
  })

  it('rechaza un email inexistente con 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nadie@vox.test', password: 'contrasena-segura' })

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'Email o contraseña incorrectos' })
  })

  it('exige email y contraseña', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'alumno@lingora.test' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Email y contraseña requeridos' })
  })
})

describe('GET /api/auth/me', () => {
  it('responde 401 sin cookie', async () => {
    const res = await request(app).get('/api/auth/me')

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'Unauthorized' })
  })

  it('responde 401 con un token inválido', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'speak_session=esto-no-es-un-jwt')

    expect(res.status).toBe(401)
  })

  it('devuelve el usuario con la sesión emitida por el signup', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/signup').send(VALID_STUDENT)

    const res = await agent.get('/api/auth/me')

    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({
      email: 'alumno@lingora.test',
      role: 'student',
      cefr_level: 'A2',
    })
  })
})

describe('PATCH /api/auth/update-profile', () => {
  it('actualiza el nombre y lo devuelve sin espacios sobrantes', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/signup').send(VALID_STUDENT)

    const res = await agent
      .patch('/api/auth/update-profile')
      .send({ full_name: '  Nombre Nuevo  ' })

    expect(res.status).toBe(200)
    expect(res.body.user.full_name).toBe('Nombre Nuevo')
  })

  it('responde 401 sin sesión', async () => {
    const res = await request(app)
      .patch('/api/auth/update-profile')
      .send({ full_name: 'Nombre' })

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'Unauthorized' })
  })

  it('rechaza un nombre vacío con 400', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/signup').send(VALID_STUDENT)

    const res = await agent.patch('/api/auth/update-profile').send({ full_name: '   ' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Name is required' })
  })
})

describe('POST /api/auth/logout', () => {
  it('responde ok y deja la sesión inutilizable', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/signup').send(VALID_STUDENT)

    const res = await agent.post('/api/auth/logout')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })

    const me = await agent.get('/api/auth/me')
    expect(me.status).toBe(401)
  })
})

describe('comportamiento transversal de la API', () => {
  it('/health responde sin sesión', async () => {
    const res = await request(app).get('/health')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('añade las cabeceras de seguridad a las respuestas de la API', async () => {
    const res = await request(app).get('/api/auth/me')

    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBe('DENY')
  })

  it('cierra con 401 cualquier ruta /api/* no pública sin sesión', async () => {
    const res = await request(app).get('/api/ruta-que-no-existe')

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'Unauthorized' })
  })

  it('responde 404 JSON a una ruta desconocida con sesión', async () => {
    const agent = request.agent(app)
    await agent.post('/api/auth/signup').send(VALID_STUDENT)

    const res = await agent.get('/api/ruta-que-no-existe')

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Not found' })
  })

  it('responde 400 ante un cuerpo JSON malformado', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'JSON inválido' })
  })
})
