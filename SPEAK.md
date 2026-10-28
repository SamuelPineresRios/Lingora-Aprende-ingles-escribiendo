---
title: "Speak · Lingora"
aliases:
  - Lingora
  - Vox
  - Speak
tags:
  - proyecto
  - edtech
  - ingles
  - gamificacion
  - react
  - express
  - postgresql
  - drizzle
created: 2026-10-17
updated: 2026-10-17
---

# Speak · Lingora

> [!info] Resumen
> **Lingora** (proyecto `speak_project`, paquete `@vox`) es una plataforma para **aprender inglés escribiendo**. El alumno entra en misiones narrativas con personajes, practica el vocabulario de la escena y conversa con una IA que **corrige gramática de verdad** (bloquea el avance si la frase está mal). Todo se envuelve en una capa de juego: XP, rachas, ligas, medallas, monedas, tienda, retos, álbum y rutas.

---

## 1. Qué es

- Aprendizaje **productivo**: el alumno escribe, no solo toca botones.
- **Misiones**: 170 situaciones reales (pedir un café, devolver un abrigo, negociar el alquiler, reclamar un vuelo…) e itinerarios técnicos para desarrollo de software.
- **Escena narrativa** estilo novela visual antes de cada conversación.
- **Vocabulario contextual**: 8 palabras por misión con estudio, emparejamiento, completar frases y repaso espaciado.
- **Conversación con IA**: un personaje (barista, médica, casero, agente…) responde y evalúa cada turno.
- **Corrección estricta**: errores que bloquean el avance (orden sujeto-verbo, -s de tercera persona, artículos, plurales, do/does; en nivel 3 también pasado y preposiciones) con explicación en español.
- **Progreso tipo juego**: XP, niveles, rachas, ligas, medallas, monedas, tienda de cosméticos, retos diarios/semanales, cofre sorpresa, ruleta diaria, evento de fin de semana, álbum de escenas y rutas por objetivo.
- **Modo docente**: grupos con código de acceso, asignación de misiones, panel con métricas e informes CSV.

---

## 2. Propuesta de valor (pitch corto)

> «Lingora te enseña inglés **escribiendo**: misiones con personajes que enganchan como un juego y te corrigen como un profesor.»

**Problema**: las apps divertidas no hacen producir; los tutores son caros y dan vergüenza; sin corrección real no hay mejora.

**Solución**: escribir es silencioso, accesible y se practica en cualquier lugar; la IA aporta conversación y corrección inmediata; la gamificación sostiene el hábito.

**Diferenciales**:
- Escribes y conversas (no eliges respuestas).
- La corrección **bloquea** el avance: no es decorativa.
- Progresión CEFR A1→C1 con 3 subniveles de exigencia.
- Coste de IA controlado: contenido determinista en fixtures y llamadas al modelo solo donde aportan.

---

## 3. Estado actual

- **170 misiones** repartidas en CEFR: A1 (43), A2 (44), B1 (45), B2 (19), C1 (19). Incluyen 20 misiones de desarrollo de software.
- Cada misión de A1/A2/B1 dividida en **3 subniveles (tiers)**: 5 cortas, 10 medias y 25 largas por nivel.
- **120 escenas y vocabularios** en fixtures (deterministas); el resto se genera y precarga con el pipeline de IA. La BD de desarrollo cubre las 170 misiones.
- **32 suites de test / 291 tests** en verde (Vitest + Supertest).
- Última verificación: `typecheck` ✅, `build` ✅, `eslint` 0 errores (≈38 avisos de estilo/React Compiler).

---

## 4. Arquitectura general

Monorepo con **npm workspaces**. Tres paquetes: `shared`, `backend`, `frontend`.

```text
┌────────────────────────────┐        ┌─────────────────────────────┐
│  Frontend (React + Vite)   │  HTTP  │  Backend (Express 5 + TS)   │
│  SPA en :5173 (dev)        │◄──────►│  API en :4000               │
│  Cookie HttpOnly (JWT)     │        │  Drizzle ORM                │
└────────────────────────────┘        └──────────────┬──────────────┘
                                                    │ SQL
                                          ┌─────────▼─────────┐
                                          │  PostgreSQL (vox) │
                                          └───────────────────┘
                                                    │
                                     ┌──────────────┴───────────────┐
                                     │ APIs externas (opcionales)   │
                                     │ · LLM (Anthropic/OpenRouter) │
                                     │ · TTS ElevenLabs             │
                                     └──────────────────────────────┘
```

- **Frontend** consume `/api/*` (proxy de Vite en desarrollo).
- **Backend** expone una API REST con sesión por cookie y sirve datos; también orquesta las llamadas al LLM y al TTS.
- **Shared** contiene tipos/utilidades comunes (`UserAvatar`, CEFR, introducciones, backdrops, sesión).

---

## 5. Estructura del repositorio

```text
speak_project/
├── package.json                # workspaces: shared, backend, frontend
├── shared/
│   └── src/
│       ├── avatar.ts           # generador y catálogo de avatares voxel
│       ├── backdrop.ts         # fondos de módulo/escena
│       ├── cefr.ts             # niveles y etiquetas
│       ├── introduction.ts     # tipos de escena y personajes
│       ├── routes.ts / session.ts / index.ts
├── backend/
│   ├── src/
│   │   ├── app.ts              # composición de Express (createApp)
│   │   ├── index.ts            # único que hace listen()
│   │   ├── config/env.ts       # validación de variables de entorno
│   │   ├── db/
│   │   │   ├── client.ts       # conexión Drizzle
│   │   │   ├── schema.ts       # 23 tablas y tipos
│   │   │   └── errors.ts       # UNIQUE_VIOLATION, sqlStateOf
│   │   ├── lib/                # dominios puros y clientes externos
│   │   │   ├── ai.ts           # LLM (Anthropic | OpenAI-compatible)
│   │   │   ├── elevenlabs.ts   # TTS
│   │   │   ├── xp.ts, league.ts, medals.ts, store.ts
│   │   │   ├── quests.ts, drills.ts, learning-paths.ts
│   │   │   ├── weekend-event.ts, season.ts, date-keys.ts
│   │   │   ├── friend-code.ts, http-retry.ts, authorization.ts
│   │   ├── middleware/         # authenticate, api-access-guard,
│   │   │                       # require-auth, security, error
│   │   ├── modules/            # un módulo por dominio (ver §8)
│   │   └── utils/              # errores HTTP, fechas, params, semana
│   ├── scripts/                # seeds, generadores, backfills, IA
│   │   └── fixtures/           # missions / introductions / vocabulary
│   └── tests/                  # 32 suites + helpers (resetDb, fixtures)
└── frontend/
    └── src/
        ├── components/         # piezas reutilizables (ver §9)
        ├── pages/              # una página por ruta
        ├── lib/                # api, hooks, store, avatar, mensajes
        ├── styles/globals.css  # tipografía, efectos, data-font-legacy
        └── App.tsx             # rutas y layouts
```

---

## 6. Stack tecnológico

| Capa | Tecnología | Notas |
|---|---|---|
| Lenguaje | **TypeScript 5** | Todo el monorepo; `tsc --noEmit` como typecheck |
| Frontend | **React 18** | SPA con React Router 7 |
| Build frontend | **Vite 8** | Proxy de `/api` al backend en desarrollo |
| Estilos | **Tailwind CSS 3** (+ `tailwindcss-animate`) | Sistema visual propio, modo oscuro |
| Tipografía | **Poppins** (global), Sora, DM Sans, JetBrains Mono | Escena/emparejamiento/conversación usan `data-font-legacy` (DM Sans/JetBrains) |
| Iconos | **lucide-react** | |
| Gráficas | **recharts** | Radar de habilidades y evolución semanal |
| Backend | **Node.js + Express 5** | API REST, `createApp()` para tests |
| ORM | **Drizzle ORM 0.45** | Esquema en código, `drizzle-kit push` |
| Base de datos | **PostgreSQL** | `vox` (desarrollo) y `vox_test` (tests) |
| Sesión | **jose** (JWT) + cookie HttpOnly | Firma HS256 con `JWT_SECRET` |
| Contraseñas | **bcryptjs** | 12 rondas |
| Parsing | **cookie-parser**, `express.json` (límite 1 MB) | |
| Tests | **Vitest 5 + Supertest** | Integración contra `vox_test`, IA mockeada |
| Lint | **ESLint 10 + typescript-eslint + react-hooks** | 0 errores |
| Tooling | `concurrently`, `node --watch`, scripts de seed/backfill | |

### Frontend, librerías auxiliares
- `clsx` + `tailwind-merge` → utilidad `cn()`.
- `react-router-dom` 7 → rutas protegidas por rol.
- Sin librería de estado global: hooks propios + `useSyncExternalStore` (tienda/tema).

### Backend, decisiones relevantes
- **ESM** (`"type": "module"`), imports con extensión `.ts`.
- `node --watch --env-file-if-exists=.env.local` para desarrollo.
- Módulos por dominio con `routes.ts` + `service.ts` (y `prompts.ts` donde hay IA).

---

## 7. Base de datos (PostgreSQL + Drizzle)

### Identidad y grupos
| Tabla | Contenido |
|---|---|
| `users` | Alumnos y docentes: email, hash, rol, nombre, avatar (jsonb), `cefr_level`, `friend_code`, idioma, alta |
| `groups` | Grupos/clases (docente, nombre, institución, código de acceso, consentimiento) |
| `group_members` | Pertenencia alumno↔grupo |
| `mission_assignments` | Misiones asignadas por un docente a un grupo (con vencimiento) |

### Contenido educativo
| Tabla | Contenido |
|---|---|
| `missions` | 170 misiones: título, descripción, objetivo, contexto, personaje, nivel CEFR, `tier` (1-3), duración base |
| `mission_introductions` | Escena narrativa: título, descripción, personajes, líneas con traducción, expresiones útiles, backdrop, versión |
| `mission_vocabulary` | 8 palabras clave por misión (palabra, traducción, ejemplo, traducción del ejemplo) |
| `word_lookups` | Caché global de fichas de palabras (traducción, categoría, formas verbales, ejemplos) |

### Aprendizaje y evaluación
| Tabla | Contenido |
|---|---|
| `responses` | Texto producido por el alumno, tiempo, estado (`in_progress`/`completed`), grupo |
| `evaluations` | Notas de comprensión, gramática y riqueza léxica; juicio (`ADVANCE`/`PAUSE`), feedback, estructuras detectadas, **mejoras estructuradas** (original/corrección/explicación) y **XP otorgado** |
| `narrative_states` | Estado de la escena por alumno/misión (completada, pausada…) — fuente de «misión completada» |
| `weekly_aggregates` | Agregado semanal por alumno: tiempo, misiones, comprensibilidad media |
| `saved_words` | Vocabulario personal con repaso espaciado (etapa 1/3/7/21 días, `review_due_at`, lapsos) |

### Progreso, economía y recompensas
| Tabla | Contenido |
|---|---|
| `coin_ledger` | Libro de monedas (compras, retos, cofres; importes con signo) |
| `purchases` | Propiedad de artículos no consumibles (marcos, títulos, temas) |
| `student_loadout` | Lo equipado: marco, títulos (hasta 3), tema |
| `medals` | Medallas ganadas (permanentes) |
| `streak_shields` | Escudos de racha disponibles/usados |
| `quest_claims` | Retos reclamados por periodo (día/semana), con monedas pagadas |

### Social y eventos
| Tabla | Contenido |
|---|---|
| `friendships` | Solicitudes y amistades (una fila por pareja) |
| `mission_challenges` | Retos 1v1 asíncronos: misión, retador, retado, notas, estado, ganador derivado |
| `daily_surprises` | Sorpresa diaria: misión sorteada, bonus de XP, consumida o no |
| `grammar_errors` | Errores que bloquean, por tipo (alimentan los drills de puntos débiles) |

> [!note] Fuente de verdad de «misión completada»
> `narrative_states.state = 'completed'` es lo que usan las tarjetas de misión, el álbum, las rutas y las medallas. Las respuestas/evaluaciones alimentan XP, notas, informes y agregados.

---

## 8. Backend: módulos y API

### Módulos (`backend/src/modules/`)
| Módulo | Responsabilidad |
|---|---|
| `auth` | Registro, login, logout, `me`, actualización de nombre/avatar, **modo invitado** y conversión a cuenta |
| `missions` | Listado por nivel, detalle, envío de la conversación, evaluación, XP, agregados |
| `introductions` | Escenas narrativas (generación/caché y entrega) |
| `vocabulary` | Vocabulario de misión (generación/caché) y **vocabulario activo** |
| `chat` | Turnos de rol con la IA (apertura/turno), esquemas JSON, hints, registro de errores |
| `evaluations` / `responses` | Consulta de evaluaciones y respuestas |
| `students` | Progreso, rachas, ranking global y liga semanal, habilidades, actividad, informe semanal, avatar, medallas |
| `store` | Catálogo, compra, equipar (marcos, títulos, temas, escudos) |
| `quests` | Retos diarios/semanales, cofre sorpresa, ruleta diaria |
| `reviews` | Repaso espaciado del vocabulario |
| `medals` | Catálogo y entrega perezosa de medallas |
| `season` | Pase de temporada: XP de temporada, casillas y monedas |
| `social` | Amigos, liga privada, retos 1v1 |
| `events` | Evento de fin de semana (escena, doble XP, marco exclusivo) |
| `drills` | Puntos débiles: registro de errores y banco de ejercicios |
| `album` | Álbum de escenas (cartas y colecciones por nivel) |
| `paths` | Rutas por objetivo (rebanada del nivel del alumno) |
| `teachers` | Grupos, panel docente, informes CSV, alertas de inactividad |
| `tts` | Texto a voz (ElevenLabs + caché en disco) |
| `words` | Fichas de palabras (hover) y vocabulario guardado |
| `admin` | Métricas internas (emails de `ADMIN_EMAILS`) |

### Rutas montadas (`app.ts`)
```text
GET  /health
/api/auth            authRouter
/api/missions        missionsRouter, introductionsRouter, vocabularyRouter
/api/students        studentsRouter, eventsRouter, drillsRouter, albumRouter,
                     pathsRouter, storeRouter, questsRouter, reviewsRouter
/api/social          socialRouter
/api/teachers        teachersRouter
/api/evaluations     evaluationsRouter
/api/responses       responsesRouter
/api/chat            chatRouter
/api/tts             ttsRouter
/api/words           wordsRouter
/api/admin           adminRouter
```

### Endpoints destacados
| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/api/auth/guest` | Entrar sin cuenta (sesión de prueba de 2 misiones) |
| POST | `/api/auth/signup` · `/login` · `/logout` | Alta (convierte al invitado), acceso, cierre de sesión |
| GET | `/api/auth/me` | Usuario de la sesión |
| PATCH | `/api/auth/update-profile` | Cambiar el nombre visible |
| GET | `/api/missions` | Misiones del nivel con estado |
| GET | `/api/missions/:id/introduction` | Escena (cacheada/generada) |
| GET | `/api/missions/:id/vocabulary` | 8 palabras clave |
| POST | `/api/chat` | Turno de conversación (rol, esquema, error_type) |
| POST | `/api/missions/:id/submit` | Envío/evaluación de la misión (XP, retos, sorpresa, evento) |
| GET | `/api/students/:id/xp` · `/season` · `/activity` | Progreso, pase y calendario |
| GET | `/api/students/ranking?metric=` · `/:id/league` | Ranking global y liga semanal |
| GET | `/api/students/:id/weekly-stats` · `/weekly-report` | Agregados e informe semanal |
| GET | `/api/students/:id/skills` · `/session-summary` | Radar de habilidades y resumen |
| GET/POST | `/api/students/:id/store` · `/purchase` · `/equip` | Tienda |
| GET/POST | `/api/students/:id/quests` · `/:questId/claim` · `/surprise` | Retos, cofre y ruleta |
| GET | `/api/students/:id/medals` | Medallas (entrega perezosa) |
| GET | `/api/students/:id/album` | Cartas y colecciones |
| GET | `/api/students/:id/paths` | Rutas por objetivo |
| GET | `/api/students/:id/weaknesses` | Puntos débiles y sesión de drills |
| GET | `/api/students/:id/improvements` | Historial de errores con corrección y explicación |
| GET | `/api/students/:id/active-vocabulary` | Vocabulario producido vs. pendiente |
| GET | `/api/social/me` | Código de amigo, amigos y solicitudes |
| POST | `/api/social/friends/request` · `/respond` | Solicitudes |
| GET | `/api/social/league` · `/challenges` | Liga privada y retos 1v1 |
| POST | `/api/social/challenges` · `/:id/decline` | Crear/rechazar reto |
| GET | `/api/teachers/...` | Grupos, panel, informes |
| GET | `/api/tts?text=&voice=` | Audio MP3 (con caché) |

---

## 9. Frontend: páginas y componentes

### Páginas (`frontend/src/pages/<área>`)
| Ruta | Página | Qué muestra |
|---|---|---|
| `/login`, `/signup` | Login, Signup | Acceso y alta (alumno/docente) |
| `/missions` | Missions | Catálogo, filtros, retos diarios, repaso, puntos débiles, banner del evento |
| `/mission/:id` | MissionPage → MissionScreen | Escena → vocabulario → preparación → chat → informe |
| `/feedback`, `/session-summary` | Feedback, SessionSummary | Resultado de la misión y resumen de sesión |
| `/words` | Words | Vocabulario guardado + **vocabulario activo** |
| `/album` | Album | Colección de escenas y medallas por nivel |
| `/paths` | Paths | Rutas por objetivo como **camino de videojuego**: carretera, estaciones y tu avatar en el nodo actual |
| `/mistakes` | Mistakes | **Errores**: historial de correcciones por misión (qué dijiste, cómo se dice y por qué) |
| `/ranking` | Ranking | Liga semanal y ranking global |
| `/friends` | Friends | Liga privada, solicitudes y retos 1v1 |
| `/season` | Season | Pase de temporada y reto semanal |
| `/store` | Store | Marcos, títulos, temas y escudos |
| `/groups`, `/join-group` | StudentGroups, JoinGroup | Grupos del alumno |
| `/profile` | Profile | Perfil, radar, actividad, informe semanal, medallas |
| `/avatar` | Avatar | Editor de avatar, marco y título |
| `/dashboard`, `/group/:id`, … | TeacherDashboard, GroupDetail… | Zona docente |

### Estructura del frontend
- **`features/mission/`**: pantalla de misión, `api`, tipos/constantes/utilidades, `hooks/` (conversación, desafío, flujo, introducción y envío) y `components/` (fases, chat, compositor, escena, overlays, informe). La escena, el chat y el reporte viven juntos en el feature.
- **`components/layout/`**: `StudentLayout`, `StudentSidebar`, `ProtectedRoute`, `RouteTracker`, `ModuleTransitionLayer`, `ModuleBackdrop` y sprites de fondo.
- **`components/progress/`**: `XpBar`, `WeeklyReport`, `ActivityHistory`, `MedalBadge`.
- **`components/gamification/`**: `QuestBoard`, `CoinRain`, `WeekendEventBanner`, `StreakNotice`.
- **`components/learning/`**: `ActiveVocabulary`, `ReviewSession`, `WeaknessDrills`.
- **`components/profile/`**, **`components/teacher/`**, **`components/onboarding/`** y **`components/ui/`**: marcos, vista docente, invitado y primitivas de UI.
- **`pages/{auth,missions,learning,profile,social,teacher}/`**: páginas agrupadas por área.

### Componentes clave
- **Misión**: `features/mission` → `MissionScreen` orquesta fases; `ConversationMessages` (historial), `TypewriterMessage`, `InteractiveWords` (ficha/guardar), `GrammarToast`, `StepHintToast`, `GuestLimitNotice`, `XpBar`.
- **Vocabulario**: `VocabularyQuiz` (estudio → emparejar → completar frases → resumen), `ReviewSession` (SRS), `WeaknessDrills` (puntos débiles con «¿Por qué?»), `ActiveVocabulary`.
- **Juego**: `QuestBoard` (`DailyQuests`/`WeeklyQuests`), `MedalBadge`, `FrameRing`, `CoinRain`, `ModuleBackdrop`, `WeekendEventBanner`.
- **Perfil y progreso**: `ActivityHistory`, `WeeklyReport`, `StudentProfileModal`, `StudentSidebar`, `StudentLayout`, `ProtectedRoute`, `RouteTracker`.

---

## 10. Contenido educativo

### Misiones y subniveles
- **170 misiones** con `cefr_level` y `tier` (1-3), incluidas 20 de desarrollo de software.
- Tiers por nivel A1/A2/B1: **5 cortas / 10 medias / 25 largas**.
- Cada tier sube exigencia: más pasos (2 → 3 → 4-5), duraciones (120/180/240 s en A1; 180/240/300 en A2; 240/300/360 en B1) y palabras (5/6/7 en A1; 6/7/8 en A2 y B1).
- Objetivo y contexto detallados con pasos numerados; el prompt de IA divide el objetivo en tareas.

### Escena y vocabulario
- **Fixtures deterministas**: `missions.json` (170), `introductions.json` (120 escenas) y `vocabulary.json` (120 listas de 8 palabras). El contenido de las misiones nuevas se genera con IA y se cachea en BD (5 palabras por misión).
- Escenas: título, descripción, personajes (A=IA, B=alumno), líneas con traducción (se guardan en BD, no se muestran), expresiones útiles y fondo.
- Sin botón de traducción: el diálogo se lee solo en inglés. Las palabras de la escena, al pasar el cursor, solo ofrecen **guardarlas** (sin ficha ni significado).
- Las misiones sin escena/vocabulario en fixture se generan/cachean (IA) y quedan en BD.

### Desarrollo de software (ruta técnica)
- **20 misiones A1→C1** pensadas para programadores: primer día, repositorio, daily, bug, pull request, code review, explicar un lenguaje, blocker, pruebas, arquitectura, incidente/postmortem, estimación, CI/CD, system design, mentoría, migración y escalabilidad.
- **Dificultad progresiva**: A1 (3), A2 (4), B1 (5), B2 (4), C1 (4); dentro del nivel, `tier` 1→3. La ruta muestra la rebanada del CEFR del alumno.
- **Escenas y vocabulario técnico** generados con el pipeline: `pull request`, `branch`, `deploy`, `staging`, `latency`, `trade-off`, `postmortem`, `rollback`, `sharding`, `eventual consistency`…
- **Ambiente dev**: icono de código y acento verde en Rutas; escenas de oficina/videollamada/whiteboard y fondos blueprint con paleta verde/cian.

### Actividades antes de la misión
1. **Estudio**: 8 palabras con traducción y ejemplo.
2. **Emparejamiento**: palabra ↔ traducción con líneas animadas.
3. **Completar frases**: 3 frases de la escena con hueco y 3 opciones.
4. **Resumen** y paso a la conversación.

### Chat y corrección
- Turno estructurado por JSON Schema: mensaje, traducción, rating 1-5, feedback, `correctedText`, `missing_step`, `confused`, `error_type`, progreso, `mission_completed`.
- **Rechazo gramatical**: si el turno trae `error_type` (el modelo solo lo marca cuando el error bloquea **según el nivel**), el mensaje **no se envía**: se retira del chat, se abre una **modal** con la frase correcta, la explicación y una **micro-lección de 60 s**, y se obliga a **reescribir la frase** (validación local) con **pistas graduadas** (regla → inicio → frase completa). En el Desafío cuesta un corazón.
- Errores **bloqueantes** (no avanza el paso) con nota de coach en español. La severidad sube con el CEFR: **A1 es indulgente** (solo bloquea lo ininteligible, fuera de tema o si falta la información clave; el nivel 1 nunca bloquea), **A2/B1 moderados** y **B2/C1 más estrictos** (tiempos, preposiciones, colocaciones y naturalidad). La evaluación del informe también puntúa con criterios de nivel.
- El personaje reacciona en escena; si no entiende, aparece un **«?»** sobre su cabeza.
- Sin traducción del mensaje: el alumno lee en inglés (la traducción se guarda en BD para análisis, pero no se muestra).
- Botón **«2 pistas»**: la IA devuelve exactamente dos respuestas posibles (inglés + español) para contestar al personaje, una vez por turno.
- Puntos débiles: el tipo de error se guarda y alimenta drills con explicación («¿Por qué?»).
- La conversación ocupa todo el ancho (sin panel lateral de frases) y el avatar fijo de la esquina se oculta durante la misión.

### Repaso y medición
- SRS de palabras guardadas (1/3/7/21 días).
- Informe semanal: misiones, XP, tiempo, precisión, evolución de 6 semanas, palabras, estructuras y **«Reglas a mejorar»** con los errores de la semana.
- Vocabulario activo: palabras del vocabulario de misiones completadas que ya aparecen en los textos del alumno.

---

## 11. Gamificación y enganche

| Sistema | Detalle |
|---|---|
| **XP y niveles** | XP por evaluación; `missionXp` con bonus por primera vez y multiplicador de racha; niveles por umbral |
| **Rachas** | Días seguidos, escudos para salvar un día (`streak_shields`) |
| **Ligas** | Liga semanal por brackets de 15, zonas de ascenso/descenso; ranking global por XP/misiones/tiempo |
| **Medallas** | 25 permanentes (niveles, misiones, rachas, palabras, repasos, perfectas, compras, grupo…); entrega perezosa |
| **Monedas y tienda** | Libro de monedas; marcos, títulos (hasta 3), temas de acento y escudos |
| **Retos** | 4 diarios (misión, XP, minutos, palabras) + 3 semanales (misiones, XP, notas altas); monedas al reclamar |
| **Cofre** | Premio **variable** por pesos: 40/80/150/300 monedas o escudo de racha |
| **Ruleta diaria** | Misión al azar del nivel con **+50 % XP** (una vez al día; consumo único) |
| **Evento de fin de semana** | Escena especial por nivel con **+100 % XP** y **Marco Fin de Semana** exclusivo |
| **Amigos** | Código de 6 caracteres, solicitudes, liga privada con momentum («a N XP de…»), retos 1v1 asíncronos («misma misión, mejor nota») |
| **Álbum** | 170 cartas de escenas/personajes; colecciones por nivel con la medalla del nivel como premio |
| **Rutas** | 6 itinerarios por objetivo (Viajar, Vida diaria, Conocer gente, Trabajo, Reclamaciones y **Desarrollo de software**) pintados como caminos de videojuego: cada ruta con su color, estaciones y tu avatar avanzando por el mapa |
| **Avatares** | Avatares voxel de **DiceBear** con catálogo de partes y semilla por alumno, editor, marcos animados cuyo color sigue el tema equipado; avatar fijo en la esquina inferior derecha |

> [!tip] Bucle de enganche
> Señal (recordatorios/racha) → acción (misión corta) → recompensa (XP, monedas, cofre, sorpresa) → inversión (cosméticos, colección, liga, amigos).

---

## 12. IA y APIs externas

### Proveedor de LLM (configurable)
- Cliente único en `backend/src/lib/ai.ts` (`completeChat`) usado por chat, evaluación y generación de contenido.
- **Dos familias**:
  - `anthropic` (por defecto): API nativa de Anthropic (`/v1/messages`), modelo por defecto **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`).
  - `openai`: cualquier API compatible (OpenRouter, DeepSeek, Groq, Ollama…), con `response_format` para salida estructurada.
- **Salida estructurada** por JSON Schema; prompts en `chat/prompts.ts` y módulos de generación.
- **Resiliencia**: timeout de 60 s, reintentos con backoff para 408/429/5xx, enfriamiento de 60 s tras errores de cliente (clave/crédito), y traducción de errores del proveedor a 502 (sesión intacta).
- Configuración actual del entorno de desarrollo: OpenRouter (modelo gratuito) mediante `.env.local`; el repo **no** contiene claves.

> [!warning] Cuota gratuita
> El plan gratuito de OpenRouter limita las peticiones diarias; al agotarse, el chat devuelve 502 y la app avisa. `npm run ai:credits -w @vox/backend` muestra el estado; `ai:check` valida el modelo.

### TTS (voz)
- **ElevenLabs** opcional (voces A/B configurables) con **caché en disco** por frase (`TTS_CACHE_DIR`, MP3 inmutable, escritura atómica). Si no hay clave, se usa la voz nativa del navegador cuando existe.
- Rutas de voz responden 503/502 sin proveedor, sin romper la escena.

### Otros servicios externos
- **DiceBear** (`api.dicebear.com`): genera los avatares voxel (10.x `voxel-art`) y los sprites pixel-art de fondo (9.x `pixel-art`) como SVG vía URL con semilla. Sin clave; dependencia externa para las imágenes de avatar.
- **Google Fonts** (Sora, Poppins, DM Sans, JetBrains Mono) vía `@import` en CSS.
- **PostgreSQL local** (no es un servicio externo gestionado).
- Pendiente: **email** (informe semanal) requeriría proveedor de correo.

---

## 13. Seguridad y autenticación

- **Sesión**: JWT firmado con `jose` (HS256), cookie **HttpOnly**, `SameSite=Lax`, expiración de 7 días. El cliente nunca guarda el token.
- **Contraseñas**: `bcryptjs` con 12 rondas; nunca se devuelve el hash.
- **Middleware**:
  - `securityHeaders`: cabeceras defensivas (nosniff, DENY, etc.).
  - `authenticate` + `apiAccessGuard`: resolución de sesión y control de acceso.
  - `requireAuth`: rutas protegidas.
  - `errorHandler`: errores HTTP sin filtrar detalles internos.
- **Autorización por recurso**: `ownsResource` (el alumno solo ve lo suyo; docentes solo sus grupos). Los endpoints **nunca** confían en un id del cliente para decidir propiedad.
- **Validación**: límite de body 1 MB, validación de tipos de entrada, whitelist de tipos de error, códigos HTTP correctos.
- **Secretos**: solo en `backend/.env.local` (ignorado por git). Rotar `JWT_SECRET` invalida sesiones.
- **Modo invitado**: al entrar sin sesión se crea una cuenta `is_guest` (A1, avatar base) y se entra directo a Misiones. Puede mirar el sistema y jugar **2 misiones de prueba**; la prueba **no paga XP** ni asciende de nivel y tiene un presupuesto de **30 llamadas de IA**. Ranking, amigos, grupos y unirse a grupos están cerrados (frontend con `GuestGate` y API con `requireAccount`); los invitados tampoco aparecen en rankings/ligas ajenas. Al registrarse, `POST /api/auth/signup` **convierte la misma cuenta**: conserva misiones, evaluaciones, avatar y palabras, y desde ahí empieza a generar XP. `backend/src/lib/guests.ts` define los topes; los invitados se limpian a los 7 días y la creación está limitada por IP.
- **Tests**: suite de control de acceso y permisos por módulo, incluido `guest.test.ts` (entrada, topes, conversión y privacidad).

---

## 14. Configuración (`.env.local`)

Copiar `backend/.env.example` → `backend/.env.local`.

| Variable | Obligatoria | Uso |
|---|---|---|
| `PORT` | no (4000) | Puerto del backend |
| `NODE_ENV` | no | Entorno |
| `DATABASE_URL` | **sí** | PostgreSQL (por defecto `postgresql://postgres@127.0.0.1:5432/vox`) |
| `JWT_SECRET` | **sí** | Firma de la sesión (mín. 32 caracteres) |
| `ANTHROPIC_API_KEY` | para IA nativa | Clave Anthropic |
| `ANTHROPIC_MODEL` | no | Modelo Claude (por defecto Haiku 4.5) |
| `AI_PROVIDER` | no | `anthropic` (defecto) u `openai` |
| `AI_BASE_URL` | con `openai` | Ej. `https://openrouter.ai/api/v1` |
| `AI_API_KEY` | con `openai` | Clave del proveedor compatible |
| `AI_MODEL` | con `openai` | Modelo a usar |
| `AI_REASONING` | no | `off`/`low`/`medium`/`high` (razonadores) |
| `ELEVENLABS_API_KEY` | no | Voz natural de la escena |
| `ELEVENLABS_VOICE_A/B` | no | Voces de los personajes |
| `TTS_CACHE_DIR` | no | Caché de audio (`backend/.cache/tts`) |
| `ADMIN_EMAILS` | no | Acceso a métricas internas |

---

## 15. Scripts y comandos

### Raíz
```bash
npm run dev          # API + web a la vez (concurrently)
npm run dev:api      # backend en :4000 (node --watch)
npm run dev:web      # frontend en :5173 (Vite)
npm run build        # build de todos los workspaces
npm run typecheck    # tsc --noEmit en todos
npm run lint         # eslint .
npm test             # tests de todos los workspaces
```

### Backend
```bash
npm run db:push -w @vox/backend         # aplicar esquema Drizzle a vox
npm run db:push:test -w @vox/backend    # aplicar esquema a vox_test
npm run missions:seed -w @vox/backend -- --no-prewarm  # sembrar fixtures
npm run missions:generate -w @vox/backend              # generar misiones con IA
npm run missions:renumber -w @vox/backend              # renumerar ids (m-001…)
npm run content:prewarm -w @vox/backend                # precalentar escenas/vocab
npm run backdrops:backfill -w @vox/backend             # fondos de escena
npm run vocabulary:backfill -w @vox/backend            # vocabulario (IA)
npm run genders:backfill -w @vox/backend               # géneros de personajes
npm run xp:backfill -w @vox/backend                    # recalcular XP histórico
npm run ai:check -w @vox/backend                       # probar el proveedor IA
npm run ai:credits -w @vox/backend                     # saldo/cupo del proveedor
```

### Tests
```bash
npm test -w @vox/backend                    # suite completa
npm test -w @vox/backend -- album           # filtrar por nombre
npm test -w @vox/backend -- --watch         # modo watch
```

---

## 16. Tests y verificación

- **Vitest + Supertest** contra `vox_test`; `resetDb()` entre tests y fixtures (`signupActor`, `createMission`, `createGroup`).
- La IA se **mockea** (`vi.mock('../src/lib/ai.ts')`) para que los flujos sean deterministas.
- Cobertura por dominio: auth, acceso, misiones, evaluación, chat, vocabulario, palabras, repaso, progreso, ranking, ligas, medallas, tienda, temporada, XP, rachas, grupos, docentes, informes, retos, sorpresas, evento, amigos/retos 1v1, drills, álbum, rutas, TTS, prompts y flujos de IA.
- **32 suites, 291 tests** (estado actual).
- **Verificación E2E** (scripts temporales con Chromium por CDP, no versionados):
  - Escena → vocabulario → completar frases → misión.
  - Chat con proveedor simulado (error → «?», progreso 0; acierto → avance).
  - Amigos: liga, solicitudes y retos.
  - Cofre/ruleta, evento, álbum, rutas, informe semanal, drills y vocabulario activo.
  - En todas: capturas revisadas y 0 errores de render.

---

## 17. Convenciones y decisiones de diseño

- **Módulos por dominio** con `routes.ts` + `service.ts`: la lógica no vive en las rutas.
- **Fixtures deterministas** para contenido (misiones, escenas, vocabulario): la IA solo se usa donde aporta (conversación, generación puntual, fichas de palabras) y se cachea.
- **Una única fuente de verdad** por regla: p. ej., «misión completada» = `narrative_states`; XP = `evaluations.xp_awarded`.
- **Cachés**: escenas, vocabulario, fichas de palabras, audio TTS y contenido precargado.
- **Coste de IA controlado**: esquemas estrictos, prompts con pocas llamadas, reintentos acotados y enfriamiento.
- **Autorización backend-first**: nunca se confía en ids/roles del cliente.
- **Accesibilidad/legibilidad**: tipografías grandes en lectura, sin traducciones que revelen la respuesta, contraste alto, móvil cuidado.
- **Estética**: tokens propios (cian/esmeralda/ámbar/coral/violeta), fondos de módulo, animaciones sutiles y avatares voxel.

---

## 18. Deuda técnica y próximos pasos

- [ ] **Email del informe semanal** (hoy es solo in-app): requiere proveedor de correo.
- [ ] **Creador de misiones para docentes** (C11c): plantillas y asignación.
- [ ] **Planes y pagos** (C12) y **white-label / vista de padres** (C13).
- [ ] Rotar la clave antigua de OpenRouter que quedó expuesta en un chat de desarrollo.
- [ ] `frontend/src/pages/Store.tsx` tiene un cambio local sin commitear (limpieza de comentario, ajena al feature).
- [ ] `.opencode/` sigue sin versionar.
- [ ] Automatizar los E2E de navegador (hoy son scripts manuales en `/tmp`).
- [ ] Revisar avisos de React Compiler (`set-state-in-effect`) en varias páginas.

---

## 19. Glosario

| Término | Significado |
|---|---|
| **Misión** | Escena + vocabulario + conversación con objetivo; unidad de contenido |
| **Tier (subnivel)** | Dificultad dentro de un CEFR: 1 corta, 2 media, 3 exigente |
| **Escena** | Introducción narrativa con personajes, líneas y fondo |
| **Turno** | Intercambio alumno ↔ personaje en el chat |
| **Bloqueante** | Error gramatical que impide avanzar el paso |
| **SRS** | Repaso espaciado del vocabulario (1/3/7/21 días) |
| **XP** | Puntos de experiencia por misión evaluada |
| **Racha** | Días seguidos con actividad; escudos la protegen |
| **Liga** | Grupo semanal de 15 alumnos por XP |
| **Pase** | Temporada con casillas y recompensas |
| **Reto** | Objetivo diario/semanal reclamable |
| **Cofre / ruleta** | Recompensas sorpresa del día |
| **Álbum** | Colección de cartas (escenas/personajes) |
| **Ruta** | Itinerario curado por objetivo (viajar, trabajo…) |
| **Puntos débiles** | Errores frecuentes del alumno + drills con explicación |
| **Errores** | Historial de correcciones estructuradas por misión (dijiste → correcto + porqué), con enlace desde el informe |
| **Rechazo gramatical** | Modal con corrección, micro-lección y reescritura obligatoria; en el Desafío cuesta un corazón |
| **Pistas** | Botón «2 pistas»: dos respuestas posibles de la IA por turno |
| **Vocabulario activo** | Palabras que el alumno ya produce en sus textos |
