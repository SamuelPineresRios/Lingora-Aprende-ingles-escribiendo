/**
 * Lógica del modo conversación: pistas de vocabulario y turnos de roleplay.
 */
import { completeChat, type ChatMessage } from '../../lib/ai.ts'
import { HttpError } from '../../utils/http-error.ts'
import {
  HINTS_SCHEMA,
  ROLEPLAY_OPENING_SCHEMA,
  ROLEPLAY_TURN_SCHEMA,
  buildHintsPrompt,
  buildOpeningMessage,
  buildRoleplaySystemPrompt,
  type MissionContext,
} from './prompts.ts'

export interface HintsResult {
  key_verbs: unknown
  useful_phrases: unknown
  grammar_tips: unknown
}

function parseJsonObject(content: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(content)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // cae al error de abajo
  }

  console.error('[chat] El proveedor devolvió un JSON inválido')
  throw new HttpError(502, 'Respuesta inválida del proveedor de IA')
}

/** Pistas de vocabulario para responder a la última pregunta del personaje. */
export async function requestHints(params: {
  lastMessage: string
  mission: MissionContext
  userLevel: string
}): Promise<HintsResult> {
  const content = await completeChat({
    messages: [{ role: 'user', content: buildHintsPrompt(params) }],
    schema: HINTS_SCHEMA,
  })

  const parsed = parseJsonObject(content)
  return {
    key_verbs: parsed.key_verbs,
    useful_phrases: parsed.useful_phrases,
    grammar_tips: parsed.grammar_tips,
  }
}

interface RawChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  rating?: number
}

function readMessages(value: unknown): RawChatMessage[] {
  if (!Array.isArray(value)) return []

  const messages: RawChatMessage[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const message = item as Record<string, unknown>
    if (typeof message.content !== 'string') continue
    if (message.role !== 'system' && message.role !== 'user' && message.role !== 'assistant') continue

    messages.push({
      role: message.role,
      content: message.content,
      ...(typeof message.rating === 'number' ? { rating: message.rating } : {}),
    })
  }

  return messages
}

export async function requestRoleplayTurn(params: {
  rawMessages: unknown
  mission: MissionContext
  userLevel: string
}): Promise<Record<string, unknown>> {
  const messages = readMessages(params.rawMessages)

  // Se cuentan los ratings de los turnos anteriores para decidir si la
  // conversación ya puede cerrarse.
  let validRatings = 0
  let highRatings = 0
  const apiMessages: ChatMessage[] = messages.map(message => {
    if (message.rating !== undefined) {
      validRatings++
      if (message.rating > 3.5) highRatings++
    }
    return { role: message.role, content: message.content }
  })

  const successRate = validRatings > 0 ? highRatings / validRatings : 0
  const shouldEnd = validRatings >= 3 && successRate > 0.5

  const systemPrompt =
    buildRoleplaySystemPrompt({ mission: params.mission, userLevel: params.userLevel }) +
    (shouldEnd
      ? '\n\n(System Note: The student has performed well enough to pass. You may wrap up the conversation if the objective is complete.)'
      : '')

  const fullMessages: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...apiMessages]

  // Sin turnos previos, se pide al personaje que abra la escena. El esquema es
  // distinto porque no hay respuesta del alumno que valorar.
  const isOpening = messages.length === 0
  if (isOpening) {
    fullMessages.push(buildOpeningMessage(params.mission))
  }

  const content = await completeChat({
    messages: fullMessages,
    maxTokens: 500,
    schema: isOpening ? ROLEPLAY_OPENING_SCHEMA : ROLEPLAY_TURN_SCHEMA,
  })

  try {
    const parsed: unknown = JSON.parse(content)
    const data = (parsed ?? {}) as Record<string, unknown>

    return {
      message: {
        role: 'assistant',
        content: data.message,
        rating: data.rating,
      },
      estimated_time: data.estimated_time || 30,
      feedback: data.feedback,
      correctedText: data.correctedText || null,
      /** Lo que le falta al paso actual; alimenta la ayuda, no la voz del bot. */
      missingStep: data.missing_step ?? null,
      /** El personaje se quedó confundido (fuera de tema o error gramatical). */
      confused: isOpening ? false : data.confused === true,
      progress: data.progress || 0,
      mission_completed: data.mission_completed,
    }
  } catch {
    // El proveedor respondió texto plano: se entrega como mensaje sin metadatos.
    return {
      message: { role: 'assistant', content },
      estimated_time: 30,
      feedback: null,
    }
  }
}
