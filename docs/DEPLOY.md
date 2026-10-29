# Despliegue: Vercel + Render + Neon

Arquitectura recomendada:

- **Frontend Vercel**: Vite estático (`frontend/dist`).
- **API Render**: Express/Node con el proceso completo (IA, limpieza de invitados y cookies).
- **PostgreSQL Neon**: las 170 misiones y su contenido generado.
- **Sin ElevenLabs**: no se configura `ELEVENLABS_API_KEY`; la escena usa la voz nativa del navegador.
- **IA obligatoria**: el chat y la evaluación necesitan `ANTHROPIC_API_KEY` o un proveedor compatible con OpenAI. Es el único servicio que no tiene un plan gratuito permanente.

## Requisitos

- Cuenta de Vercel, Render y Neon.
- URL directa y URL pooled de Neon.
- Clave de IA.
- Los comandos `pg_dump` y `psql` en local para copiar el contenido.

## 1. Crear el esquema y cargar las 170 misiones

En Neon, copia la conexión **directa** (sin `-pooler`).

El repositorio incluye un script que aplica el esquema y copia las tres tablas
de contenido desde tu base local: `missions`, `mission_introductions` y
`mission_vocabulary`.

```bash
LOCAL_DATABASE_URL="postgresql://postgres@127.0.0.1:5432/vox" \
NEON_DIRECT_URL="postgresql://...neon.tech/neondb?sslmode=require" \
npm run deploy:content
```

Al terminar debe mostrar:

```text
misiones | escenas | vocabularios | dev
      170 |     170 |          170 |  20
```

El script no sobrescribe una base que ya tenga misiones. Si necesitas repetirlo,
usa una base nueva o vacía explícitamente las tres tablas.

No ejecutes `missions:seed` si vas a usar el script: el script conserva las
escenas y el vocabulario que ya generaste y evita gastar IA.

## 2. API en Render

El `render.yaml` crea el servicio con:

- Build: `npm ci`
- Start: `npm run start -w @vox/backend`
- Health check: `/health`
- Plan: `free`
- Node: `24.0.0`

Importa el repositorio en Render y aplica el Blueprint (`render.yaml`). Las
variables marcadas con `sync: false` se configuran en el panel:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Conexión **pooled** de Neon |
| `ANTHROPIC_API_KEY` | Clave de Anthropic (o variables `AI_*`) |
| `ADMIN_EMAILS` | Opcional |
| `JWT_SECRET` | Render la genera automáticamente |

No configures `ELEVENLABS_API_KEY` ni `TTS_CACHE_DIR`: la voz será la del
navegador y no habrá caché TTS.

Comprueba:

```bash
curl https://TU-API.onrender.com/health
# {"ok":true}
```

El plan Free se suspende tras 15 minutos sin tráfico; la primera petición puede
tardar aproximadamente un minuto. Para producción, cambia el plan o usa Railway.

## 3. Frontend en Vercel

1. Importa el repositorio en Vercel.
2. Root Directory: la raíz del monorepo.
3. Vercel usará `vercel.json`:
   - Build: `npm run build -w @vox/frontend`
   - Output: `frontend/dist`
   - Install: `npm ci`
4. Sustituye en `vercel.json` la URL de ejemplo:

```json
"destination": "https://TU-API.onrender.com/api/:path*"
```

por la URL real de Render. El rewrite mantiene `/api` en el mismo origen que el
frontend, así la cookie de sesión funciona sin CORS.
5. Despliega. No necesitas variables de base de datos en Vercel.

## 4. Verificación

- `/health` del backend responde.
- Signup/login y cookie `speak_session`.
- Una misión normal y `m-158` (ruta de desarrollo).
- Recarga directa de `/missions` y `/mission/m-158` (fallback SPA).
- Chat con IA.
- Escena sin audio de ElevenLabs: debe usar la voz nativa o quedar sin audio.
- Móvil.

## Variables y secretos

- Los secretos viven en Render (y en Neon para la base); nunca en el repo.
- `backend/.env.production.example` contiene solo los nombres y valores de
  ejemplo.
- No subas `backend/.env.local`.
- `JWT_SECRET` de producción debe ser distinto del local.
- Si usas un proveedor compatible con OpenAI, configura `AI_PROVIDER`,
  `AI_BASE_URL`, `AI_API_KEY` y `AI_MODEL`; no necesitas Anthropic.

## Coste orientativo

- Vercel Hobby: $0 para proyectos personales/no comerciales.
- Render Free: $0, con suspensión por inactividad.
- Neon Free: $0, 1 GB y ~100 CU-horas.
- ElevenLabs: $0 porque no se usa.
- IA: pago por uso; Haiku 4.5 cuesta $1/1M tokens de entrada y $5/1M de salida.
  Antes de abrir al público, añade rate limiting y límites de gasto.

## Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| Vercel devuelve 404 en `/api/...` | Sustituye `TU-API` por la URL Render o revisa el rewrite |
| El login no mantiene la sesión | Comprueba que la API se llama a través de Vercel, no directo al dominio de Render |
| `pg_dump` falla por FK al restaurar | El script restaura en orden (misiones → escenas → vocabulario); no mezcles los ficheros |
| Neon dice que no hay tablas | Ejecuta primero `db:push`; el script lo hace |
| El chat responde 503 | Falta `ANTHROPIC_API_KEY` o el proveedor `AI_*` |
| La escena no tiene voz | Es esperado sin ElevenLabs; el navegador puede ofrecer voz nativa |
| Render tarda en responder | Plan Free suspendido por inactividad; primera petición lenta |
