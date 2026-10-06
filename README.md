# Letoura

Plataforma de aprendizaje de inglés donde **escribir es el único camino para avanzar**.
Estudiantes completan misiones de conversación escritas, reciben evaluación de un LLM y
reciben retroalimentación y los docentes crean grupos, asignan misiones y siguen el progreso.

Documentación de funcionalidades: [`docs/VOCABULARIO.md`](docs/VOCABULARIO.md) — palabras
interactivas, fichas con caché compartida, calentado en segundo plano y «Mi vocabulario».

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + **Vite** + React Router 7 + Tailwind CSS |
| Backend | Node.js + **Express 5** (TypeScript ejecutado nativamente por Node) |
| Base de datos | **PostgreSQL + Drizzle ORM** — única fuente de verdad |
| Autenticación | JWT (`jose`) en cookie HttpOnly + `bcryptjs` |
| Evaluación / chat LLM | **Anthropic Claude** (Haiku 4.5) vía `backend/src/lib/ai.ts` |
| Tests | Vitest + Supertest (integración de API) · ESLint |

El repositorio es un **monorepo con npm workspaces**: `shared/`, `backend/` y `frontend/`.
Un solo `npm install` en la raíz instala todo.

---

## Estructura

```
.
├── package.json              # workspaces y scripts raíz
├── tsconfig.base.json        # opciones de TypeScript compartidas
├── eslint.config.mjs
├── shared/                   # @vox/shared — contrato común
│   └── src/
│       ├── session.ts        # SessionPayload, UserRole
│       ├── routes.ts         # rutas públicas / de profesor / de alumno
│       └── cefr.ts           # niveles MCER, umbrales y etiquetas
├── backend/                  # @vox/backend — API Express
│   ├── drizzle.config.ts
│   ├── vitest.config.ts
│   ├── src/
│   │   ├── app.ts            # factoría de la app (exportada para Supertest)
│   │   ├── index.ts          # listen()
│   │   ├── config/env.ts     # validación de entorno al arrancar
│   │   ├── db/
│   │   │   ├── client.ts     # pool de postgres.js + Drizzle
│   │   │   ├── schema.ts     # las 13 tablas
│   │   │   └── errors.ts     # lectura de SQLSTATE
│   │   ├── middleware/       # seguridad, sesión, autorización, errores
│   │   ├── modules/          # auth, missions, introductions, vocabulary, teachers, students, words,
│   │   │                     # evaluations, responses, chat, admin
│   │   │                     #   routes.ts (HTTP) + service.ts (dominio)
│   │   ├── lib/              # ai.ts (cliente de Anthropic)
│   │   └── utils/
│   └── tests/                # tests de integración (6 ficheros, 96 casos)
└── frontend/                 # @vox/frontend — SPA React
    ├── vite.config.ts        # alias @, proxy /api -> :4000
    ├── index.html
    └── src/
        ├── main.tsx          # BrowserRouter + AuthProvider
        ├── App.tsx           # tabla de rutas + guards
        ├── pages/            # 16 páginas
        ├── components/       # 30 componentes (+ ui/)
        ├── lib/              # utils y hooks (useAuth, useMediaQuery, ...)
        └── styles/globals.css
```

---

## Puesta en marcha

```bash
# 1. Dependencias (raíz: instala los tres workspaces)
npm install

# 2. Base de datos
createdb vox
createdb vox_test                                    # para los tests

# 3. Entorno del backend
cp backend/.env.example backend/.env.local           # rellena JWT_SECRET
openssl rand -hex 32                                 # valor para JWT_SECRET

# 4. Esquema
npm run db:push -w @vox/backend                      # crea las 13 tablas en vox
npm run db:push:test -w @vox/backend                 # y en vox_test

# 5. Arrancar API + web
npm run dev
# API  -> http://localhost:4000
# Web  -> http://localhost:5173  (el proxy de Vite reenvía /api al backend)
```

No hace falta ningún servicio externo salvo PostgreSQL. El contenido de las misiones
ya está en la base de datos local.

---

## Variables de entorno

Plantilla: `backend/.env.example`. **Ninguna** está versionada.

| Variable | Obligatoria | Uso |
|----------|-------------|-----|
| `DATABASE_URL` | Sí | PostgreSQL |
| `JWT_SECRET` | Sí | Firma de la cookie de sesión (`openssl rand -hex 32`) |
| `PORT` | No | Puerto de la API (por defecto `4000`) |
| `NODE_ENV` | No | `development` \| `production` |
| `ANTHROPIC_API_KEY` | No | Evaluación y tutor ([console.anthropic.com](https://console.anthropic.com/settings/keys)). Sin ella la app funciona: las rutas de IA responden `503` y el envío de misiones usa una evaluación de respaldo |
| `ANTHROPIC_MODEL` | No | Modelo de Claude. Por defecto `claude-haiku-4-5-20251001` (snapshot fijado de Haiku 4.5) |
| `ELEVENLABS_API_KEY` | No | Voz natural de la escena narrativa ([elevenlabs.io](https://elevenlabs.io/app/settings/api-keys)). Sin ella la escena usa la voz nativa del navegador. El audio se cachea en `backend/.cache/tts` |
| `ELEVENLABS_VOICE_A` / `_B` | No | Voces de los dos personajes (ids de ElevenLabs). Por defecto Sarah y Adam |
| `TTS_CACHE_DIR` | No | Directorio de la caché de audio (por defecto `backend/.cache/tts`) |
| `ADMIN_EMAILS` | No | Emails (separados por coma) con acceso a `/api/admin/metrics` |

El frontend **no usa variables de entorno**: habla siempre con `/api` en su mismo origen.

---

## Cómo encaja todo

0. Cada misión se abre con una **escena narrativa** (dos personajes, con
traducción) generada una sola vez por misión y guardada en
`mission_introductions`; después el alumno pasa a la preparación y al chat.
La escena trae además la **dirección de arte del fondo** (`backdrop`: tipo de
lugar, estilo, luz y paleta) que el frontend pinta con capas SVG en la escena,
el chat y las tarjetas de misión. Las escenas anteriores a la función no tienen
`backdrop` y usan un respaldo por palabras clave; las que falten se rellenan
con `npm run backdrops:backfill -w @vox/backend`.
1. El navegador carga la SPA servida por **Vite** (`:5173` en desarrollo).
2. Toda llamada a `/api/*` la reenvía el **proxy de Vite** al backend (`:4000`). Al
   ser el mismo origen para el navegador, la cookie de sesión viaja sin CORS.
3. **Express** resuelve la sesión, aplica el guard global de la API, ejecuta el
   handler del módulo y responde JSON.
4. **Drizzle** es la única vía de acceso a PostgreSQL. No hay archivos JSON ni
   ningún otro almacén.

### TypeScript sin transpilador

Node 26 ejecuta directamente los `.ts` del backend (type stripping). Eso impone tres
reglas que el propio `tsc` verifica (`erasableSyntaxOnly`, `verbatimModuleSyntax`):

- las importaciones de tipos siempre con `import type`;
- extensiones explícitas en imports relativos (`./schema.ts`);
- nada de `enum`, `namespace` con código ni parameter properties.

### Salida estructurada de la IA

Las tres llamadas al modelo que devuelven JSON —evaluación de misión, turno del
roleplay y generación de la escena narrativa— envían un **esquema JSON** en
`output_config.format`. Anthropic lo aplica con decodificación restringida, así
que la respuesta es siempre JSON válido: no depende de que el prompt se obedezca,
no llega envuelta en vallas de markdown y no hacen falta reintentos por formato.
Los esquemas viven junto a sus prompts, en `backend/src/modules/*/prompts.ts`.

El turno de apertura del roleplay usa un esquema distinto al resto: sin respuesta
del alumno no hay nada que valorar, así que `rating` y `feedback` no existen en
ese caso (si se declararan nullables, el modelo también los dejaría vacíos en los
turnos siguientes).

---

## Autenticación y autorización

- Registro y login con email/contraseña (`bcryptjs`, cost 12).
- Sesión en **cookie HttpOnly + SameSite=Lax** con JWT firmado (7 días). `Secure`
  en producción.
- **API**: `apiAccessGuard` (espejo del antiguo `middleware.ts`) cierra toda
  `/api/*` salvo las rutas públicas, y exige rol `teacher` en `/api/teachers/*`.
  Además, cada router repite la comprobación con `requireAuth` / `requireTeacher`
  (defensa en profundidad).
- **Páginas**: al ser una SPA, la protección es de cliente: `<ProtectedRoute>`
  espera a resolver la sesión y redirige a `/login` (o a `/missions` si un alumno
  abre una ruta de profesor).

### Roles

| Rol | Acceso |
|-----|--------|
| `student` | Misiones, feedback, resumen, grupos |
| `teacher` | Dashboard, crear grupos, asignar misiones, ver progreso |
| — | `ADMIN_EMAILS` habilita `/api/admin/metrics`, sea cual sea el rol |

---

## API

Operaciones agrupadas por módulo (`backend/src/modules/*/routes.ts`).

| Módulo | Operaciones |
|--------|-------------|
| auth | `POST /signup` · `POST /login` · `POST /logout` · `GET /me` · `PATCH /update-profile` |
| missions | `GET /api/missions` · `GET /api/missions/:id` · `POST /:id/submit` · `POST /:id/mark-completed` |
| introductions | `GET /api/missions/:id/introduction` (genera si falta) · `POST /:id/introduction/regenerate` (docentes) |
| vocabulary | `GET /api/missions/:id/vocabulary` (genera las 5 palabras si faltan) · `POST /:id/vocabulary/regenerate` (docentes) |
| students | `GET /api/students/groups` · `POST /join-group` · `GET /:id/weekly-stats` · `GET /:id/skills` · `GET /:id/activity` · `GET /:id/session-summary` |
| teachers | `GET /api/teachers/groups` · `POST /groups/create` · `GET /groups/:id` · `GET /groups/:id/students` · `GET/POST /groups/:id/assign-mission` · `GET /students/:id/profile` |
| evaluations | `GET /api/evaluations/:id` |
| responses | `GET /api/responses/:id` |
| chat | `POST /api/chat` (roleplay y pistas) |
| words | `POST /api/words/lookup` (traducción con caché) · `POST /api/words/warm` (calentado en segundo plano) · `POST /api/words` · `GET /api/words` · `DELETE /api/words/:id` |
| admin | `GET /api/admin/metrics` |
| — | `GET /health` (fuera de `/api`, sin sesión) |

**Contrato de error**: `{ "error": "<mensaje>" }` con el status correspondiente.
`401` sin sesión, `403` sin permiso, `404` no encontrado, `409` conflicto,
`502/503` fallos del proveedor de IA.

---

## Base de datos

**13 tablas** en `backend/src/db/schema.ts`:

`users` · `missions` · `mission_introductions` · `mission_vocabulary` ·
`narrative_states` · `groups` · `group_members` · `mission_assignments` ·
`responses` · `evaluations` · `weekly_aggregates` · `word_lookups` ·
`saved_words`

- Claves foráneas con `ON DELETE CASCADE`, y `SET NULL` donde la fila sobrevive al
  grupo (por ejemplo, una respuesta pertenece al alumno, no al grupo).
- Restricciones únicas en `email`, `access_code`, `(grupo, alumno)`,
  `(alumno, semana)`, `evaluations.response_id`, `word_lookups.word` y
  `(alumno, ficha)` en `saved_words`.
- Índices por patrón de consulta: `responses(student_id, submitted_at)`,
  `responses(student_id, submitted_at)`, etc.
- Los campos se llaman **igual que las columnas** (`cefr_level`, `scene_context`),
  así que la fila de la BD y el JSON de la API son el mismo objeto.

Las escrituras que tocan varias tablas van en **transacción** (envío de misión,
envío de misión) y los contadores semanales se actualizan con `ON CONFLICT` y
aritmética en SQL, para que dos envíos concurrentes no se pisen.

**Cambiar el esquema**:

```bash
# 1. edita backend/src/db/schema.ts
# 2. aplica
npm run db:push -w @vox/backend
npm run db:push:test -w @vox/backend
```

---

## Tests

```bash
npm test              # raíz -> suite del backend (96 casos)
npm run test:watch -w @vox/backend
```

Los tests son de **integración**: montan la app con Supertest y hablan con una
PostgreSQL real (`vox_test`), que se vacía entre casos. Cubren:

- contrato de auth (cookie, `Max-Age` de 7 días, validaciones, 409 de duplicado);
- misiones: submit con evaluación de respaldo, umbral por nivel, agregado semanal,
  promoción de nivel;
- grupos: creación, unión idempotente, asignaciones, paneles;
- **matriz de IDOR y roles**: cada ruta con `401/403` esperado, aislamiento entre
  profesores y propiedad de respuestas/evaluaciones;
- flujos de IA con `completeChat` mockeado (ADVANCE, formato inválido, fallo del
  proveedor).

La BD de test se prepara una vez con `npm run db:push:test -w @vox/backend`.

---

## Comandos

```bash
npm run dev          # API (:4000) + web (:5173) en paralelo
npm run dev:api      # sólo backend
npm run dev:web      # sólo frontend
npm run build        # build de producción del frontend (Vite)
npm run typecheck    # tsc en shared + backend + frontend
npm run lint         # ESLint en todo el monorepo
npm test             # tests del backend
npm run db:push -w @vox/backend       # aplicar el esquema a vox
npm run db:push:test -w @vox/backend  # aplicar el esquema a vox_test
```

---

## Limitaciones conocidas y deuda técnica

| Elemento | Detalle |
|----------|---------|
| Panel del profesor y umbral | `GET /api/teachers/groups/:id/students` marca una misión como completada sólo si la evaluación es `ADVANCE`; el resto del sistema también acepta el umbral numérico del nivel. Con el respaldo técnico (65, `PAUSE`) los dos criterios discrepan. Es comportamiento heredado. |
| `xp_awarded` nunca se escribe | `evaluations.xp_awarded` está siempre a `null`, así que `total_points` en `/api/students/groups` es siempre 0. Falta decidir la fórmula de XP. |
| `/api/chat` confía en el cliente | El contexto de la misión (`objective`, `scene_context`, `character_name`) y el historial llegan en el body. Sólo afecta al propio alumno, pero lo correcto es cargar la misión por `id` en el servidor. |
| Bundle sin code splitting | El build de Vite genera ~1 MB (286 KB gzip) en un único chunk. Trocear por ruta es una mejora pendiente. |
| Sin realtime | El dashboard docente usa polling. |
| Alta de docentes abierta | Cualquiera puede registrarse como `teacher`. Requiere invitación o aprobación. |
| Autorización a nivel de API | PostgreSQL se usa con un único rol compartido: el aislamiento lo garantizan los guards de Express, no row-level security. |
| Sin despliegue definido | Esta fase prioriza local. Ver abajo. |

---

## Despliegue

Pendiente de definir (fase posterior). Puntos a resolver:

- `DATABASE_URL` debe apuntar a un PostgreSQL accesible; el esquema se aplica con
  `drizzle-kit push` desde local, no en cada despliegue.
- El frontend es estático (`frontend/dist/`): se puede servir desde un CDN/host
  estático con fallback SPA a `index.html`.
- Si frontend y API quedan en dominios distintos, harán falta CORS con
  credenciales y `SameSite=None; Secure` en la cookie, además de
  `Strict-Transport-Security`.
- Añadir rate limiting en auth y en las rutas de IA (ver `SECURITY.md`).
