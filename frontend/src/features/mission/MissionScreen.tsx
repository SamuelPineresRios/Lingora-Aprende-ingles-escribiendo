import { useNavigate } from 'react-router-dom'
import { resolveAvatar } from '@vox/shared'
import { GrammarCorrectionModal } from '@/features/mission/components/GrammarCorrectionModal'
import { GrammarToastStack } from '@/features/mission/components/GrammarToast'
import { StepHintStack } from '@/features/mission/components/StepHintToast'
import { VocabularyQuiz } from '@/features/mission/components/VocabularyQuiz'
import { useAuth } from '@/lib/hooks/useAuth'
import { useGuestTrialLimit } from '@/lib/hooks/useGuestTrialLimit'
import { useProgress } from '@/lib/hooks/useProgress'
import { studentAvatarUrl } from '@/lib/avatar'
import { IntroductionPhase } from './components/IntroductionPhase'
import { MissionChat } from './components/MissionChat'
import { MissionCompletionOverlay } from './components/MissionCompletionOverlay'
import { MissionFailedOverlay } from './components/MissionFailedOverlay'
import { MissionHintsModal } from './components/MissionHintsModal'
import { MissionSubmittingOverlay } from './components/MissionSubmittingOverlay'
import { PreparationPhase } from './components/PreparationPhase'
import { useChallenge } from './hooks/useChallenge'
import { useMissionConversation } from './hooks/useMissionConversation'
import { useMissionFlow } from './hooks/useMissionFlow'
import { useMissionIntroduction } from './hooks/useMissionIntroduction'
import { useMissionSubmission } from './hooks/useMissionSubmission'
import { missionCharacters } from './utils'
import type { MissionScreenProps } from './types'

export function MissionScreen({ mission, studentId, groupId }: MissionScreenProps) {
  const { user } = useAuth()
  const { progress } = useProgress(user?.id)
  const { guestLimit, flagGuestLimit, clearGuestLimit } = useGuestTrialLimit()
  const navigate = useNavigate()

  const studentAvatar = user
    ? studentAvatarUrl(resolveAvatar({ id: user.id, avatar: user.avatar }))
    : null

  const introduction = useMissionIntroduction(mission.id)
  const challenge = useChallenge()
  const conversation = useMissionConversation({
    mission,
    userLevel: user?.cefr_level || mission.cefr_level,
    onMistake: challenge.loseHeart,
    flagGuestLimit,
  })
  const flow = useMissionFlow({ challenge, conversation, clearGuestLimit })
  const submission = useMissionSubmission({
    mission,
    studentId,
    groupId,
    startTime: flow.startTime,
    conversation,
    challenge,
    flagGuestLimit,
    onSubmitted: conversation.markSubmitted,
  })

  const { ai, student } = missionCharacters(introduction.introduction)
  const retryStart = () => flow.start(challenge.mode)

  if (flow.phase === 'introduction') {
    return (
      <IntroductionPhase
        mission={mission}
        studentAvatar={studentAvatar}
        introduction={introduction.introduction}
        loading={introduction.loading}
        error={introduction.error}
        titleDone={introduction.titleDone}
        onTitleDone={introduction.markTitleDone}
        onRetry={introduction.retry}
        onContinueWithoutScene={flow.toVocabulary}
        onFinish={flow.toVocabulary}
        onSkip={flow.toVocabulary}
        onSkipToMission={flow.toPreparation}
      />
    )
  }

  if (flow.phase === 'vocabulary') {
    return (
      <VocabularyQuiz
        missionId={mission.id}
        cefrLevel={mission.cefr_level}
        onFinish={flow.toPreparation}
      />
    )
  }

  if (flow.phase === 'preparation') {
    return (
      <PreparationPhase
        mission={mission}
        introduction={introduction.introduction}
        studentAvatar={studentAvatar}
        isThinking={conversation.isThinking}
        onStartFree={() => flow.start('free')}
        onStartChallenge={() => flow.start('evaluation')}
        onRepeatIntroduction={flow.repeatIntroduction}
      />
    )
  }

  return (
    <>
      <MissionChat
        mission={mission}
        studentAvatar={studentAvatar}
        aiCharacter={ai}
        studentCharacter={student}
        progress={progress}
        mode={challenge.mode}
        hearts={challenge.hearts}
        missionProgress={conversation.missionProgress}
        guestLimit={guestLimit}
        conversation={conversation}
        isSubmitting={submission.isSubmitting}
        onBack={() => navigate(-1)}
        onRetryStart={retryStart}
      />

      {submission.isSubmitting && <MissionSubmittingOverlay />}

      <MissionCompletionOverlay
        open={conversation.completionOpen}
        onSubmit={submission.submit}
        onContinue={conversation.dismissCompletion}
      />

      <MissionFailedOverlay
        open={challenge.failed}
        timeUp={challenge.timeUp}
        onRetry={flow.retryChallenge}
        onDismiss={challenge.dismissFailed}
      />

      {conversation.grammarCorrection && (
        <GrammarCorrectionModal
          correction={conversation.grammarCorrection}
          onClose={conversation.dismissGrammarCorrection}
        />
      )}

      <MissionHintsModal
        open={conversation.hintsOpen}
        hints={conversation.hints}
        onClose={() => conversation.closeHints(true)}
      />

      <StepHintStack hints={conversation.stepHints} onDismiss={conversation.dismissStepHint} />
      <GrammarToastStack
        notices={conversation.grammarNotices}
        onDismiss={conversation.dismissGrammarNotice}
      />
    </>
  )
}
