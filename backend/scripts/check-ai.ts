/**
 * Comprueba el proveedor de IA configurado con una llamada mínima.
 *
 *   npm run ai:check -w @vox/backend
 *
 * Imprime el proveedor, el modelo, la latencia y una respuesta estructurada de
 * prueba. Sirve para validar la clave y el modelo al desplegar o al cambiar de
 * proveedor, sin arrancar toda la aplicación.
 */
import { env } from '../src/config/env.ts'
import { completeChat, DEFAULT_AI_MODEL, isAiConfigured } from '../src/lib/ai.ts'

if (!isAiConfigured()) {
  console.error('No hay proveedor configurado: define AI_API_KEY (con AI_PROVIDER=openai) o ANTHROPIC_API_KEY')
  process.exit(1)
}

console.log(`Proveedor: ${env.aiProvider} · Modelo: ${DEFAULT_AI_MODEL}`)

const started = Date.now()
const text = await completeChat({
  messages: [
    { role: 'system', content: 'Responde solo con JSON, sin explicaciones ni vallas de markdown.' },
    { role: 'user', content: 'Devuelve un objeto JSON así: {"ok": true, "saludo": "hola"}.' },
  ],
  schema: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      saludo: { type: 'string' },
    },
    required: ['ok', 'saludo'],
    additionalProperties: false,
  },
  maxTokens: 100,
})

console.log(`Respuesta en ${Date.now() - started} ms:`)
console.log(text)

try {
  const parsed = JSON.parse(text) as { ok?: unknown; saludo?: unknown }
  console.log(`JSON válido · ok=${String(parsed.ok)} · saludo=${String(parsed.saludo)}`)
} catch {
  console.error('La respuesta NO es JSON válido')
  process.exitCode = 1
}
