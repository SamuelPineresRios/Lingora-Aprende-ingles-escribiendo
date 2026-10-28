import { readJson } from '@/lib/api'
import type { ChatMessage, Mission, MissionIntroduction, MissionMode } from './types'

export interface ApiResult<T> {
  ok: boolean
  status: number
  data: T | null
}

async function request<T>(path: string, init: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(path, init)
  return { ok: res.ok, status: res.status, data: await readJson<T>(res) }
}

export interface ChatTurnResponse {
  message?: ChatMessage
  feedback?: string
  correctedText?: string
  error_type?: string
  missingStep?: string
  confused?: boolean
  progress?: number
  mission_completed?: boolean
  error?: string
  code?: string
}

export interface HintsResponse {
  hints?: Array<{ en?: unknown; es?: unknown }>
  error?: string
  code?: string
}

export interface SubmitResponse {
  response_id?: string
  evaluation_id?: string
  error?: string
  code?: string
}

export interface IntroductionResponse {
  introduction?: MissionIntroduction
  error?: string
}

interface ChatContext {
  mode: MissionMode
  mission: Mission
  userLevel: string
}

function chatPayload(context: ChatContext, messages: ChatMessage[]) {
  return JSON.stringify({
    mode: 'chat',
    missionMode: context.mode,
    messages,
    mission: context.mission,
    userLevel: context.userLevel,
  })
}

export function openMissionChat(context: ChatContext): Promise<ApiResult<ChatTurnResponse>> {
  return request<ChatTurnResponse>('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: chatPayload(context, []),
  })
}

export function sendMissionTurn(
  context: ChatContext,
  messages: ChatMessage[],
): Promise<ApiResult<ChatTurnResponse>> {
  return request<ChatTurnResponse>('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: chatPayload(context, messages),
  })
}

export function requestMissionHints(
  context: Omit<ChatContext, 'mode'> & { lastMessage: string },
): Promise<ApiResult<HintsResponse>> {
  return request<HintsResponse>('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'hints',
      lastMessage: context.lastMessage,
      mission: context.mission,
      userLevel: context.userLevel,
    }),
  })
}

export function submitMissionReport(params: {
  missionId: string
  studentId: string
  groupId?: string
  responseText: string
  timeTakenSeconds: number | null
  mode: MissionMode
}): Promise<ApiResult<SubmitResponse>> {
  return request<SubmitResponse>(`/api/missions/${params.missionId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      response_text: params.responseText,
      student_id: params.studentId,
      group_id: params.groupId,
      time_taken_seconds: params.timeTakenSeconds,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      mode: params.mode,
    }),
  })
}

export async function markMissionCompleted(missionId: string, groupId?: string): Promise<void> {
  await fetch(`/api/missions/${missionId}/mark-completed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group_id: groupId ?? null }),
  })
}

export function fetchMissionIntroduction(
  missionId: string,
): Promise<ApiResult<IntroductionResponse>> {
  return request<IntroductionResponse>(`/api/missions/${missionId}/introduction`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
}
