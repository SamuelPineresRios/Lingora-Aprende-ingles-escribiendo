/**
 * Cliente de IA compartido.
 *
 * Todas las rutas que hablan con el LLM pasan por `completeChat`, de modo que
 * la URL, las cabeceras, la traducción del formato y la forma de los errores
 * viven en un único sitio. Se soportan dos familias de proveedor:
 *
 * - `anthropic` (por defecto): API nativa de Anthropic.
 * - `openai`: cualquier API compatible con OpenAI (OpenRouter, DeepSeek,
 *   Groq, Ollama…), incluida la salida estructurada con `response_format`.
 *
 * Notas de la API de Anthropic:
 * - `system` no es un rol: viaja en un campo de nivel superior;
 * - `max_tokens` es obligatorio;
 * - la respuesta es una lista de bloques de contenido, no `choices`.
 */
import { env } from '../config/env.ts'
import { HttpError } from '../utils/http-error.ts'
import { fetchWithRetry, ProviderUnreachableError } from './http-retry.ts'

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'

/** Versión del contrato de la API; Anthropic exige enviarla siempre. */
const ANTHROPIC_VERSION = '2023-06-01'

/** Modelo de Anthropic por defecto: Haiku 4.5 con snapshot fijado. */
const ANTHROPIC_DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

/** Modelo activo: el del proveedor configurado, con su valor por defecto. */
export const DEFAULT_AI_MODEL =
  env.aiProvider === 'openai' ? env.aiModel : (env.anthropicModel ?? ANTHROPIC_DEFAULT_MODEL)

/** El proveedor exige `max_tokens`; este es el valor si la ruta no lo indica. */
const DEFAULT_MAX_TOKENS = 1024

/** Corta cada intento si el proveedor no responde. */
const REQUEST_TIMEOUT_MS = 60_000

/** Códigos que merecen un reintento: saturación, límite de tasa o caída. */
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504, 529])

/** Espera máxima aunque el proveedor pida más (no bloquear al alumno). */
const MAX_RETRY_DELAY_MS = 10_000

/**
 * Un error del cliente (clave inválida, cuenta sin crédito, petición mal
 * formada) no se arregla reintentando: cuando el proveedor responde uno, se
 * deja de llamar durante un enfriamiento en vez de repetir la misma llamada
 * condenada por cada palabra o mensaje.
 */
const PROVIDER_COOLDOWN_MS = 60_000
let providerBlockedUntil = 0
let providerBlockReason = ''

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** Esquema JSON de la respuesta esperada. */
export type JsonSchema = Record<string, unknown>

/** Error devuelto por el proveedor (status suyo, no del backend). */
export class AIProviderError extends Error {
  readonly status: number
  readonly detail: string | undefined

  constructor(message: string, status: number, detail?: string) {
    super(message)
    this.name = 'AIProviderError'
    this.status = status
    this.detail = detail
  }
}

/** ¿Hay proveedor de IA configurado? Lo usa el aviso de arranque. */
export function isAiConfigured(): boolean {
  return env.aiProvider === 'openai' ? Boolean(env.aiApiKey) : Boolean(env.anthropicApiKey)
}

/** Tiempo que queda de enfriamiento del proveedor (0 = disponible). */
export function providerBlockedForMs(): number {
  return Math.max(0, providerBlockedUntil - Date.now())
}

/** Reinicia el enfriamiento (tests y cambios de configuración). */
export function resetProviderCooldown(): void {
  providerBlockedUntil = 0
  providerBlockReason = ''
}

interface ProviderConfig {
  kind: 'anthropic' | 'openai'
  url: string
  headers: Record<string, string>
  defaultModel: string
}

/** Resuelve el proveedor activo y falla con 503 comprensible si falta la clave. */
function activeProvider(): ProviderConfig {
  if (env.aiProvider === 'openai') {
    if (!env.aiApiKey) throw new HttpError(503, 'Servicio de IA no configurado')
    return {
      kind: 'openai',
      url: `${env.aiBaseUrl.replace(/\/+$/, '')}/chat/completions`,
      headers: {
        Authorization: `Bearer ${env.aiApiKey}`,
        // OpenRouter agradece saber quién llama; en otros proveedores no molesta.
        'HTTP-Referer': 'https://lingora.app',
        'X-Title': 'Lingora',
      },
      defaultModel: env.aiModel,
    }
  }

  if (!env.anthropicApiKey) throw new HttpError(503, 'Servicio de IA no configurado')
  return {
    kind: 'anthropic',
    url: ANTHROPIC_MESSAGES_URL,
    headers: {
      'x-api-key': env.anthropicApiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    defaultModel: env.anthropicModel ?? ANTHROPIC_DEFAULT_MODEL,
  }
}

interface CompletionOptions {
  messages: ChatMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  /**
   * Esquema JSON que la respuesta debe cumplir. Anthropic lo aplica con
   * decodificación restringida (`output_config.format`) y los proveedores
   * compatibles con OpenAI con `response_format`; si el proveedor no lo
   * soporta, se reintenta una vez con el esquema pegado al prompt.
   */
  schema?: JsonSchema
}

interface AnthropicTurn {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Traduce la conversación al formato de Anthropic:
 * - los mensajes `system` salen del array y se concatenan en `system`;
 * - los turnos consecutivos del mismo rol se fusionan, porque la API espera
 *   turnos alternos.
 */
function toAnthropicPayload(messages: ChatMessage[]): {
  system: string
  messages: AnthropicTurn[]
} {
  const systemParts: string[] = []
  const turns: AnthropicTurn[] = []

  for (const message of messages) {
    if (message.role === 'system') {
      systemParts.push(message.content)
      continue
    }

    const last = turns[turns.length - 1]
    if (last && last.role === message.role) {
      last.content += `\n\n${message.content}`
    } else {
      turns.push({ role: message.role, content: message.content })
    }
  }

  return { system: systemParts.join('\n\n'), messages: turns }
}

/** Envía la petición al proveedor, con reintentos y timeouts compartidos. */
async function sendRequest(provider: ProviderConfig, body: Record<string, unknown>): Promise<Response> {
  try {
    return await fetchWithRetry(
      provider.url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...provider.headers },
        body: JSON.stringify(body),
      },
      {
        timeoutMs: REQUEST_TIMEOUT_MS,
        label: 'AI',
        retryableStatuses: RETRYABLE_STATUSES,
        maxRetryDelayMs: MAX_RETRY_DELAY_MS,
      },
    )
  } catch (err) {
    // Red caída, DNS o timeouts agotados: es un fallo del proveedor, no del backend.
    if (err instanceof ProviderUnreachableError) {
      throw new AIProviderError('No se pudo contactar con el proveedor de IA', 502)
    }
    throw err
  }
}

/**
 * Respuesta de error del proveedor: registra el detalle y aplica el
 * cortafuegos cuando el error no es recuperable.
 */
async function failResponse(response: Response): Promise<never> {
  const detail = await response.text().catch(() => '')

  if (!RETRYABLE_STATUSES.has(response.status)) {
    providerBlockedUntil = Date.now() + PROVIDER_COOLDOWN_MS
    providerBlockReason = `Proveedor ${response.status}: ${detail.slice(0, 200)}`
    console.error(
      `[AI] Proveedor bloqueado ${PROVIDER_COOLDOWN_MS / 1000} s por un error no recuperable:`,
      providerBlockReason,
    )
  } else {
    console.error('[AI] Error del proveedor:', response.status, detail.slice(0, 200))
  }

  throw new AIProviderError(`AI Provider Error: ${response.status} - ${detail}`, response.status, detail)
}

/** Extrae el texto del asistente del formato de Anthropic. */
async function readAnthropicText(response: Response): Promise<string> {
  const result = (await response.json()) as {
    content?: Array<{ type?: string; text?: unknown }>
  }
  const text = result.content?.find(block => block.type === 'text')?.text
  if (typeof text !== 'string' || text.length === 0) {
    console.error('[AI] Respuesta inválida del proveedor:', result)
    throw new AIProviderError('Invalid response from AI provider', 500)
  }
  return text
}

/** Extrae el texto del asistente del formato compatible con OpenAI. */
async function readOpenAiText(response: Response): Promise<string> {
  const result = (await response.json()) as {
    choices?: Array<{ finish_reason?: string; message?: { content?: unknown; reasoning?: unknown } }>
  }
  const choice = result.choices?.[0]
  const text = choice?.message?.content
  if (typeof text !== 'string' || text.length === 0) {
    // El caso típico: modelo razonador que se quedó sin tokens para responder.
    const motivo = choice?.finish_reason === 'length'
      ? 'se agotaron los max_tokens (¿modelo razonador?)'
      : choice?.message?.reasoning
        ? 'solo devolvió razonamiento, sin respuesta'
        : 'respuesta vacía'
    console.error('[AI] Respuesta inválida del proveedor:', motivo)
    throw new AIProviderError(`Invalid response from AI provider (${motivo})`, 500)
  }
  return text
}

async function completeAnthropic(
  provider: ProviderConfig,
  options: CompletionOptions,
): Promise<string> {
  const payload = toAnthropicPayload(options.messages)

  const body: Record<string, unknown> = {
    model: options.model ?? provider.defaultModel,
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    messages: payload.messages,
  }
  if (payload.system) body.system = payload.system
  if (options.temperature !== undefined) body.temperature = options.temperature
  if (options.schema) body.output_config = { format: { type: 'json_schema', schema: options.schema } }

  const response = await sendRequest(provider, body)
  if (!response.ok) await failResponse(response)
  return readAnthropicText(response)
}

/** Cuerpo compatible con OpenAI; `schema` a null deja el JSON al prompt. */
function toOpenAiBody(
  options: CompletionOptions,
  model: string,
  schema: JsonSchema | null,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: options.messages.map(message => ({ role: message.role, content: message.content })),
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
  }
  if (options.temperature !== undefined) body.temperature = options.temperature
  if (schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: 'response', schema, strict: true },
    }
  }

  // Los modelos razonadores gastan los tokens pensando y pueden quedarse sin
  // margen para la respuesta (`content: null`). Con AI_REASONING se apaga o se
  // limita; sin la variable no se envía nada y el proveedor decide.
  if (env.aiReasoning === 'off') body.reasoning = { enabled: false }
  else if (env.aiReasoning === 'low' || env.aiReasoning === 'medium' || env.aiReasoning === 'high') {
    body.reasoning = { effort: env.aiReasoning }
  }

  return body
}

/** Copia de los mensajes con el esquema pegado delante (proveedores sin `response_format`). */
function withSchemaInPrompt(messages: ChatMessage[], schema: JsonSchema): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `Responde SOLO con un JSON válido que cumpla exactamente este esquema JSON:\n${JSON.stringify(schema)}`,
    },
    ...messages,
  ]
}

/** ¿El error sugiere que el proveedor no acepta `response_format`? */
function isStructuredOutputRejection(status: number, detail: string): boolean {
  return status === 400 && /response_format|json_schema|structured|response format/i.test(detail)
}

async function completeOpenAi(
  provider: ProviderConfig,
  options: CompletionOptions,
): Promise<string> {
  const model = options.model ?? provider.defaultModel
  const response = await sendRequest(provider, toOpenAiBody(options, model, options.schema ?? null))

  if (!response.ok) {
    // Algunos proveedores rechazan `response_format`: se reintenta una vez con
    // el esquema dentro del prompt, que funciona en cualquier API de chat.
    if (options.schema && isStructuredOutputRejection(response.status, await response.clone().text())) {
      console.warn('[AI] El proveedor no aceptó response_format; se reintenta con el esquema en el prompt')
      const fallback = await sendRequest(
        provider,
        toOpenAiBody({ ...options, messages: withSchemaInPrompt(options.messages, options.schema) }, model, null),
      )
      if (!fallback.ok) await failResponse(fallback)
      return readOpenAiText(fallback)
    }
    await failResponse(response)
  }

  return readOpenAiText(response)
}

/**
 * Ejecuta una completion y devuelve el texto del asistente.
 * Lanza `AIProviderError` si el proveedor falla o responde vacío.
 */
export async function completeChat(options: CompletionOptions): Promise<string> {
  const provider = activeProvider()

  const blockedFor = providerBlockedForMs()
  if (blockedFor > 0) {
    throw new AIProviderError(
      `Proveedor de IA bloqueado ${Math.ceil(blockedFor / 1000)} s: ${providerBlockReason}`,
      503,
      providerBlockReason,
    )
  }

  return provider.kind === 'openai'
    ? completeOpenAi(provider, options)
    : completeAnthropic(provider, options)
}
