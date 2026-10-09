/**
 * Punto de entrada del backend.
 *
 *   npm run dev -w @vox/backend
 *
 * `node --watch` reinicia el proceso al cambiar un fichero y `--env-file`
 * (implícito en el script npm) carga `.env.local` sin dependencias extra.
 */
import { createApp } from './app.ts'
import { env } from './config/env.ts'
import { isAiConfigured } from './lib/ai.ts'

const app = createApp()

app.listen(env.port, () => {
  console.log(`[api] Lingora backend escuchando en http://localhost:${env.port}`)
  if (!isAiConfigured()) {
    console.warn('[api] IA sin configurar (AI_API_KEY o ANTHROPIC_API_KEY): las rutas de IA responderán 503')
  }
})
