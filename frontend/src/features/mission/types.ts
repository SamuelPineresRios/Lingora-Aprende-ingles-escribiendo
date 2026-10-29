import type { IntroductionCharacter, MissionBackdrop, MissionIntroduction } from '@vox/shared'
import type { ChatMessage } from '@/features/mission/components/ConversationMessages'
import type { GrammarCorrection } from '@/features/mission/components/GrammarCorrectionModal'
import type { GrammarNotice } from '@/features/mission/components/GrammarToast'
import type { StepHint } from '@/features/mission/components/StepHintToast'

export interface Mission {
  id: string
  title: string
  objective: string
  scene_context: string
  character_name: string
  cefr_level: string
  base_duration_seconds: number
  tier?: number | null
  key_verbs?: string[]
  useful_phrases?: string[]
  grammar_tips?: string
  backdrop?: MissionBackdrop | null
}

export interface MissionScreenProps {
  mission: Mission
  studentId: string
  groupId?: string
}

export type MissionMode = 'free' | 'evaluation'
export type MissionPhase = 'introduction' | 'vocabulary' | 'preparation' | 'active'

export interface MissionHint {
  en: string
  es: string
}

export interface MissionRewrite {
  original: string
  corrected: string
  errorType: string
}

export type { ChatMessage, GrammarCorrection, GrammarNotice, IntroductionCharacter, MissionIntroduction, StepHint }
