/**
 * Configuración de entorno del backend.
 *
 * Se valida al importar el módulo: si falta una variable obligatoria el proceso
 * muere al arrancar con un mensaje concreto, en lugar de fallar más tarde con
 * un error confuso en mitad de una petición.
 */
import { resolve } from 'node:path'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Copia backend/.env.example a ` +
        'backend/.env.local y rellénala.',
    )
  }
  return value
}

const nodeEnv = process.env.NODE_ENV ?? 'development'

function parsePort(value: string | undefined): number {
  const port = Number(value ?? 4000)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`PORT no es un puerto válido: ${value}`)
  }
  return port
}

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: parsePort(process.env.PORT),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  /**
   * Opcional: mientras esté vacía, las rutas que llaman al proveedor de IA
   * responden 503 (`Servicio de IA no configurado`) en lugar de reventar.
   */
  anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() || null,
  /** Modelo de Claude; por defecto Haiku 4.5 con snapshot fijado. */
  anthropicModel: process.env.ANTHROPIC_MODEL?.trim() || null,
  /**
   * Proveedor de IA: `anthropic` (por defecto) u `openai` para cualquier API
   * compatible con OpenAI (OpenRouter, DeepSeek, Groq, Ollama…).
   */
  aiProvider: process.env.AI_PROVIDER?.trim().toLowerCase() === 'openai' ? ('openai' as const) : ('anthropic' as const),
  /** URL base del proveedor compatible (sin la ruta final). */
  aiBaseUrl: process.env.AI_BASE_URL?.trim() || 'https://openrouter.ai/api/v1',
  /** Clave del proveedor compatible con OpenAI. */
  aiApiKey: process.env.AI_API_KEY?.trim() || null,
  /** Modelo del proveedor compatible; por defecto Haiku 4.5 vía OpenRouter. */
  aiModel: process.env.AI_MODEL?.trim() || 'anthropic/claude-haiku-4.5',
  /**
   * Opcional: mientras esté vacía, las rutas de voz responden 503 y el
   * navegador usa su voz nativa si la tiene.
   */
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY?.trim() || null,
  /** Voz del personaje A (por defecto Sarah, femenina). */
  elevenLabsVoiceA: process.env.ELEVENLABS_VOICE_A?.trim() || 'EXAVITQu4vr4xnSDxMaL',
  /** Voz del personaje B (por defecto Adam, masculina). */
  elevenLabsVoiceB: process.env.ELEVENLABS_VOICE_B?.trim() || 'pNInz6obpgDQGcFmaJgB',
  /**
   * Caché de audio en disco: cada frase distinta se sintetiza una sola vez y
   * se reutiliza con todos los alumnos. Clave con el límite mensual de
   * caracteres del plan gratuito.
   */
  ttsCacheDir: process.env.TTS_CACHE_DIR?.trim() || resolve(import.meta.dirname, '../../.cache/tts'),
  /** Emails con acceso a las métricas de administración (minúsculas). */
  adminEmails: (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean),
}
