# Seguridad de Lingora

Documento único de referencia.

---

## 1. Autenticación

**Implementación:** `backend/src/lib/auth.ts`

- Registro y login con email/contraseña.
- Hash de contraseña con `bcryptjs` (cost 12).
- JWT firmado con `JWT_SECRET` (`jose`, HS256), expiración 7 días.
- La sesión se entrega en una **cookie HttpOnly + SameSite=Lax** con `Secure`
  cuando `NODE_ENV=production`. La clave nunca se expone al JavaScript del cliente.
- Logout limpia la cookie (`clearCookieOptions`).

```typescript
// backend/src/lib/auth.ts
createToken(payload)        -> firma el JWT
verifyToken(token)          -> SessionPayload | null
sessionCookieOptions()      -> HttpOnly, SameSite, Secure en producción
clearCookieOptions()
SESSION_COOKIE_NAME         -> 'speak_session'
```

`JWT_SECRET` y `DATABASE_URL` se validan **al arrancar** (`config/env.ts`): si
faltan, el proceso muere con un mensaje concreto en lugar de fallar a mitad de
una petición.

---

## 2. Autorización: guard global + guard por ruta

**Implementación:** `backend/src/middleware/`

- `authenticate` resuelve la sesión de la cookie en **todas** las peticiones y la
  deja en `req.session`. Nunca rechaza.
- `apiAccessGuard` es la garantía global (espejo del antiguo `middleware.ts`):
  - toda `/api/*` exige sesión salvo las rutas públicas de `@vox/shared`;
  - `/api/teachers/*` exige rol `teacher`;
  - sin sesión → `401 { "error": "Unauthorized" }`; sin rol → `403 { "error": "Forbidden" }`.
- **Defensa en profundidad**: cada router vuelve a exigir lo que necesita con
  `requireAuth` / `requireTeacher`. Una ruta nueva sin guard propio sigue cerrada
  por el guard global, y un fallo del guard global no abre la ruta.
- Las páginas ya no se protegen en servidor (es una SPA): `<ProtectedRoute>`
  espera a resolver la sesión y redirige. La API **siempre** vuelve a validar, así
  que la protección de UI no es una frontera de seguridad.

La lógica de rutas y roles es única y compartida (`@vox/shared/routes.ts`): el
backend y el frontend no pueden divergir en qué ruta es de profesor.

---

## 3. Control de acceso a recursos (IDOR)

Toda consulta por ID filtra por el propietario en servidor; el `id` del path no
basta.

| Ruta | Comprobación |
|------|--------------|
| `GET /api/evaluations/:id` | `ownsResource(session, student_id, ['teacher'])` |
| `GET /api/responses/:id` | `ownsResource(session, student_id, ['teacher'])` |
| `GET /api/students/:id/weekly-stats` | `ownsResource(session, id, ['teacher'])` |
| `GET /api/students/:id/session-summary` | `ownsResource(session, id, ['teacher'])` |
| `POST /api/missions/:id/submit` | la respuesta se escribe con `student_id = session.userId` |
| `GET /api/teachers/groups/:id` | grupo propio o `404` |
| `GET/POST /api/teachers/groups/:id/*` | grupo propio o `403` |
| `GET /api/teachers/students/:id/profile` | el alumno debe pertenecer a un grupo del profesor o `403` |
| `GET /api/admin/metrics` | `session.email ∈ ADMIN_EMAILS` |

Todas están cubiertas por la matriz de tests de `backend/tests/access-control.test.ts`.

**`group_id` enviado por el cliente**: al enviar una misión, el `group_id` llega
por query string. El backend comprueba que el alumno sea miembro; si no lo es, la
respuesta se guarda **sin grupo** en lugar de atribuirse a un grupo ajeno.

---

## 4. Modelo de amenazas / controles

| Amenaza | Control |
|---------|---------|
| Sesión falsificada | JWT firmado + verificación en cada petición |
| Suplantación por headers | No se lee ningún header de identidad; sólo la cookie |
| IDOR / escalada de privilegios | Filtro por propietario + `requireTeacher`, con tests |
| SQL injection | Drizzle/Postgres: consultas parametrizadas siempre |
| XSS | React (escape por defecto). Sin CSP todavía (ver §7) |
| CSRF | SameSite=Lax + API en el mismo origen que la SPA |
| Fuga de secretos | Todo en `backend/.env.local` (gitignored) |
| Contraseñas débiles | `bcryptjs` cost 12, mínimo 8 caracteres |
| Abuso de recursos | Límite de 1 MB en el body JSON; sin rate limiting todavía |

**Cabeceras de seguridad** — `backend/src/middleware/security.ts`, aplicadas a
`/api/*`:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

---

## 5. Configuración

### Variables

Plantilla: `backend/.env.example`. Ver `README.md → Variables de entorno`.

- `.env`, `.env.local` están en `.gitignore` (patrón global, aplica a todos los
  workspaces).
- **Ninguna credencial está en el repositorio.** Verificación:

  ```bash
  git grep -nE "(sk-or-v1|sk-ant|sk_[0-9a-f]{40,}|eyJhbGciOi.*\.|service_role)"
  ```

- El frontend no maneja secretos ni variables de entorno: sólo habla con `/api`.
  El audio de la escena narrativa lo sintetiza el backend (`GET /api/tts`), que
  requiere sesión; la clave de ElevenLabs nunca llega al navegador.

### Rotación de credenciales

1. **Anthropic**: `https://console.anthropic.com/settings/keys`
2. **ElevenLabs**: `https://elevenlabs.io/app/settings/api-keys`. Conviene
   crearla **restringida** al permiso `text_to_speech` (lectura de cuenta y
   listado de voces no hacen falta).
3. **`JWT_SECRET`**: `openssl rand -hex 32` (invalida todas las sesiones activas
   — esperado)
4. **PostgreSQL**: si `DATABASE_URL` llegó a versionarse, cambia la contraseña del
   rol y actualiza la variable

---

## 6. Verificación

```bash
npm run typecheck    # tsc en shared, backend y frontend
npm run lint         # ESLint (0 errores)
npm test             # 115 tests de integración contra PostgreSQL
npm run build        # build de producción del frontend
```

La suite está en `backend/tests/`:

| Fichero | Cubre |
|---------|-------|
| `auth.test.ts` | contrato de sesión, cookie, validaciones, duplicados |
| `missions.test.ts` | umbrales por nivel, agregados, promoción |
| `groups.test.ts` | grupos, unión, asignaciones, paneles |
| `access-control.test.ts` | **matriz de IDOR y roles** |
| `ai-flows.test.ts` | flujos de IA con el proveedor mockeado |
| `introductions.test.ts` | generación única por misión, validación y permisos |
| `skills.test.ts` | métricas reales del perfil |
| `tts.test.ts` | caché de voz, validación del texto y error del proveedor |
| `activity.test.ts` | historial diario, rangos, zona horaria y permisos |
| `words.test.ts` | caché de fichas, guardado idempotente y aislamiento |

Comprobaciones manuales equivalentes:

| Caso | Esperado |
|------|----------|
| `GET /api/missions` sin cookie | `401` |
| `GET /api/missions` con JWT inválido | `401` |
| `GET /api/evaluations/<id-otro-usuario>` | `403` |
| `GET /api/teachers/groups` con alumno | `403` |
| `GET /api/admin/metrics` con alumno | `403` |
| `GET /api/admin/metrics` con `ADMIN_EMAILS` | `200` |
| Abrir `/missions` sin sesión | la SPA redirige a `/login` |

---

## 7. Deuda técnica conocida

| Elemento | Estado |
|----------|--------|
| Sin rate limiting | Auth y rutas de IA (`/api/chat`, `missions/:id/submit`) pueden ser abusadas. Añadir en el borde antes de producción. |
| Alta de `teacher` abierta | Cualquiera puede registrarse como docente. Requiere invitación o aprobación. |
| Headers incompletos | Falta CSP, `Strict-Transport-Security` y `Referrer-Policy`. |
| Sin rotación automática de claves | Ver §5. |
| Autorización sólo a nivel de API | PostgreSQL se usa con un único rol compartido: la base de datos no distingue usuarios, así que el aislamiento depende de los guards de Express. A medio plazo: rol por usuario o row-level security. |
| `/api/chat` confía en el cliente | El contexto de misión y el historial llegan en el body. Sólo afecta al propio alumno. Lo correcto es cargar la misión por `id` en el servidor. |
| Generación de contenido por misión | `GET /api/missions/:id/introduction` y `GET /api/missions/:id/vocabulary` generan con IA la primera vez y cachean por misión (compartido entre alumnos); regenerar es de docentes. Coste acotado por misión, no por alumno. |
| Consultas de vocabulario sin límite | `POST /api/words/lookup` genera una ficha con IA por palabra nueva (queda cacheada para todos) y `POST /api/words/warm` permite pedir hasta 60 de golpe para el calentado. Un alumno autenticado podría quemar créditos pidiendo palabras raras; el rate limiting del borde es la mitigación. |
| Cuota de voz sin límite por usuario | `GET /api/tts` exige sesión y tope de 300 caracteres, y la caché evita repetir frases, pero un alumno autenticado puede quemar la cuota mensual de ElevenLabs pidiendo textos únicos. Mitigación natural: el rate limiting del borde. |
| DTOs sin tipar | El frontend consume la API con tipos sueltos (`any` en varios sitios); ESLint lo deja como aviso. Compartir los DTO en `@vox/shared` es la solución natural. |
