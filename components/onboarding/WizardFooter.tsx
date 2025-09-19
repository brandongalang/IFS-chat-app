"use client"

import type { OnboardingStage } from '@/lib/onboarding/types'

const STAGE_TITLES: Record<OnboardingStage, string> = {
  stage1: 'Stage 1',
  stage2: 'Stage 2',
  stage3: 'Stage 3',
  complete: 'Complete',
}

export function WizardFooter({
  saving,
  nextDisabled,
  onNext,
  nextLabel = 'Continue',
  stage,
  stageIndex,
  totalStages,
  overallQuestionNumber,
  totalQuestions,
  progressPercent,
}: {
  saving: boolean
  nextDisabled?: boolean
  onNext?: () => void
  nextLabel?: string
  stage: OnboardingStage
  stageIndex: number
  totalStages: number
  overallQuestionNumber: number
  totalQuestions: number
  progressPercent: number
}) {
  return (
    <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1">
        <div className="text-xs text-muted-foreground" aria-live="polite">
          {saving ? 'Saving…' : 'All caught up'}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 text-center sm:px-6">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>{STAGE_TITLES[stage]} ({stageIndex + 1} of {totalStages})</span>
          <span aria-hidden="true">•</span>
          <span>Question {Math.min(overallQuestionNumber, totalQuestions)} of {totalQuestions}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted">
          <div
            className="h-1.5 rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </div>
      </div>
      <div className="flex flex-1 items-center justify-end">
        <button
          type="button"
          className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          disabled={nextDisabled}
          onClick={() => onNext?.()}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  )
}
