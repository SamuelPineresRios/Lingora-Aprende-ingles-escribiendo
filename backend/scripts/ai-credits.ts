/**
 * Muestra el saldo y los límites del proveedor de IA en consola.
 *
 *   npm run ai:credits -w @vox/backend
 *
 * Para OpenRouter consulta el saldo de la cuenta (`/credits`) y los límites de
 * la clave (`/key`), y hace una llamada mínima para leer las cabeceras de
 * límite diario de los modelos gratis (cuántas quedan y cuándo se reinician).
 * Nunca imprime la clave.
 */
import { env } from '../src/config/env.ts'

const isOpenRouter = env.aiBaseUrl.includes('openrouter.ai')
const base = env.aiBaseUrl.replace(/\/+$/, '')

function euros(value: number | undefined): string {
  return typeof value === 'number' ? value.toFixed(2) : '—'
}

function fecha(epochMs: number | null): string {
  if (!epochMs) return '—'
  return new Date(epochMs).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })
}

async function getJson(path: string): Promise<Record<string, unknown> | null> {
  if (!env.aiApiKey) return null
  const response = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${env.aiApiKey}` },
  })
  if (!response.ok) return null
  return (await response.json()) as Record<string, unknown>
}

console.log(`Proveedor: ${env.aiProvider} · Modelo: ${env.aiModel}`)
console.log(`API: ${base}${isOpenRouter ? '' : ' (créditos solo con OpenRouter)'}`)

if (isOpenRouter && env.aiApiKey) {
  // Saldo de la cuenta.
  const credits = await getJson('/credits')
  const creditsData = (credits?.data ?? credits) as Record<string, unknown> | undefined
  if (creditsData && typeof creditsData.total_credits === 'number') {
    const total = creditsData.total_credits as number
    const used = (creditsData.total_usage as number | undefined) ?? 0
    console.log(`\nSaldo de la cuenta:`)
    console.log(`  Comprado:   ${euros(total)} €`)
    console.log(`  Gastado:    ${euros(used)} €`)
    console.log(`  Disponible: ${euros(total - used)} €`)
  } else {
    console.log('\nSaldo de la cuenta: sin datos (¿clave de OpenRouter?)')
  }

  // Límites de la clave.
  const key = await getJson('/key')
  const keyData = (key?.data ?? key) as Record<string, unknown> | undefined
  if (keyData) {
    console.log(`\nLímite de la clave:`)
    console.log(`  Límite:     ${keyData.limit == null ? 'sin tope' : `${keyData.limit} €`}`)
    console.log(`  Usado:      ${euros(keyData.usage as number | undefined)} €`)
    console.log(
      `  Restante:   ${keyData.limit_remaining == null ? 'sin tope' : `${euros(keyData.limit_remaining as number)} €`}`,
    )
    console.log(`  Plan gratis: ${keyData.is_free_tier ? 'sí' : 'no'}`)
  }
}

// Cabeceras de límite diario de los modelos gratis: se leen de una petición mínima.
if (env.aiApiKey && env.aiProvider === 'openai') {
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.aiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.aiModel,
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 1,
    }),
  })

  const limite = response.headers.get('x-ratelimit-limit')
  const restantes = response.headers.get('x-ratelimit-remaining')
  const reset = response.headers.get('x-ratelimit-reset')

  console.log(`\nLímite del modelo (${env.aiModel}):`)
  if (limite || restantes) {
    console.log(`  Peticiones por ventana: ${limite ?? '—'}`)
    console.log(`  Restantes ahora:        ${restantes ?? '—'}`)
    console.log(`  Se reinicia:            ${fecha(reset ? Number(reset) : null)}`)
  } else {
    // OpenRouter solo manda estas cabeceras al alcanzar el tope diario.
    console.log('  Plan gratis: 50 peticiones al día (1.000 con 10 € de saldo).')
    console.log('  El restante exacto y el reinicio se informan al agotar el cupo (429).')
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.log(`\nAviso: la llamada de prueba respondió ${response.status}.`)
    // El error 429 trae el cupo y el reinicio dentro de su metadata.
    try {
      const parsed = JSON.parse(detail) as {
        error?: { metadata?: { headers?: Record<string, string> } }
      }
      const headers = parsed.error?.metadata?.headers ?? {}
      const restantesError = headers['X-RateLimit-Remaining'] ?? headers['x-ratelimit-remaining']
      const resetError = headers['X-RateLimit-Reset'] ?? headers['x-ratelimit-reset']
      if (restantesError != null) console.log(`  Restantes hoy: ${restantesError}`)
      if (resetError != null) console.log(`  Se reinicia:   ${fecha(Number(resetError))}`)
    } catch {
      // Sin JSON parseable se queda el aviso genérico.
    }
    if (detail.includes('free-models-per-day')) {
      console.log('  Se agotó el cupo diario de modelos gratis: espera al reinicio o añade créditos.')
    }
  } else {
    console.log('  Llamada de prueba: correcta.')
  }
} else if (!env.aiApiKey) {
  console.log('\nNo hay AI_API_KEY configurada: no se pueden consultar créditos.')
}
