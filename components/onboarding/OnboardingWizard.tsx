"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'

import { OnboardingCompletionSummary } from './OnboardingCompletionSummary'
import { QuestionCard } from './QuestionCard'
import { WizardFooter } from './WizardFooter'
import { track } from '@/lib/analytics'
import {
  OnboardingQuestion as OnboardingQuestionSchema,
  type CompletionResponse,
  type CompletionSummary,
  type OnboardingQuestion,
  type OnboardingStage,
  type ProgressUpdateRequest,
  type ProgressUpdateResponse,
  type QuestionResponse,
} from '@/lib/onboarding/types'

interface StateSummary {
  stage: OnboardingStage
  status: 'in_progress' | 'completed'
  version: number
  needs_onboarding: boolean
}

const onboardingQuestionArray = OnboardingQuestionSchema.array()

async function loadOnboardingQuestions() {
  const configModule = await import('../../config/onboarding-questions.json')
  return onboardingQuestionArray.parse(configModule.default.questions)
}

const DEFAULT_STAGE_LENGTHS = {
  stage1: 5,
  stage2: 4,
  stage3: 4,
} as const

const STAGE_TITLES: Record<OnboardingStage, string> = {
  stage1: 'Stage 1 — 5 quick probes',
  stage2: 'Stage 2 — A few context questions',
  stage3: 'Stage 3 — Somatic & Belief Mapping',
  complete: 'Onboarding Complete',
}

function stageToIndex(stage: OnboardingStage): number {
  switch (stage) {
    case 'stage1':
      return 0
    case 'stage2':
      return 1
    case 'stage3':
      return 2
    default:
      return 3
  }
}

async function fetchStage2Questions(
  fallbackBank: OnboardingQuestion[],
  logContext: string,
): Promise<OnboardingQuestion[] | null> {
  try {
    const res = await fetch('/api/onboarding/questions?stage=2', { cache: 'no-store' })
    if (!res.ok) {
      throw new Error('Failed to fetch Stage 2 questions')
    }

    const data = await res.json()
    if (Array.isArray(data?.questions)) {
      return (data.questions as OnboardingQuestion[])
        .filter(question => question.active)
        .sort((a, b) => a.order_hint - b.order_hint)
    }

    console.warn(`${logContext}: unexpected Stage 2 payload`, data)
  } catch (error) {
    console.warn(`${logContext}: falling back to local Stage 2 selection`, error)
  }

  if (fallbackBank.length >= 4) {
    return fallbackBank.slice(0, 4)
  }

  return null
}

async function withVersionRetry(
  operation: (version: number) => Promise<Response>,
  initialVersion: number,
  onVersionUpdate: (version: number) => void,
): Promise<{ response: Response; version: number }> {
  let versionToUse = initialVersion
  let response = await operation(versionToUse)

  if (response.status === 409) {
    const stateRes = await fetch('/api/onboarding/state', { cache: 'no-store' })
    if (stateRes.ok) {
      const stateData: StateSummary = await stateRes.json()
      versionToUse = stateData.version
      onVersionUpdate(stateData.version)
      response = await operation(versionToUse)
    }
  }

  return { response, version: versionToUse }
}

function ProcessingState() {
  return (
    <div className="space-y-4 rounded-md border border-border/40 bg-background/80 p-6 text-center">
      <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
      <h2 className="text-lg font-medium">Letting it land…</h2>
      <p className="text-sm text-muted-foreground">
        We&apos;re gently weaving your responses together. This takes just a moment.
      </p>
    </div>
  )
}

export function OnboardingWizard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inlineError, setInlineError] = useState<string | null>(null)

  const [version, setVersion] = useState<number>(0)
  const [stage, setStage] = useState<OnboardingStage>('stage1')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)

  const [saving, setSaving] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const [stage1Questions, setStage1Questions] = useState<OnboardingQuestion[]>([])
  const [stage2Questions, setStage2Questions] = useState<OnboardingQuestion[]>([])
  const [stage3Questions, setStage3Questions] = useState<OnboardingQuestion[]>([])
  const [stage2Bank, setStage2Bank] = useState<OnboardingQuestion[]>([])

  const [answers, setAnswers] = useState<Record<string, QuestionResponse>>({})

  const [completionSummary, setCompletionSummary] = useState<CompletionSummary | null>(null)
  const [completionRedirect, setCompletionRedirect] = useState<string>('/')

  // Initial load
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        setLoading(true)
        setError(null)

        let nextStage: OnboardingStage = 'stage1'

        const stateRes = await fetch('/api/onboarding/state', { cache: 'no-store' })
        if (stateRes.ok) {
          const stateData: StateSummary = await stateRes.json()
          nextStage = stateData.stage
          if (!cancelled) {
            setStage(stateData.stage)
            setVersion(stateData.version)
          }

          if (stateData.stage === 'complete') {
            try {
              const summaryRes = await fetch('/api/onboarding/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ version: stateData.version }),
              })
              if (summaryRes.ok) {
                const completion = (await summaryRes.json()) as CompletionResponse
                if (!cancelled) {
                  setCompletionSummary(completion.summary ?? null)
                  setCompletionRedirect(completion.redirect)
                }
              }
            } catch (summaryError) {
              console.warn('Failed to load existing onboarding summary', summaryError)
            }
          }
        } else {
          if (!cancelled) {
            setStage('stage1')
            setVersion(0)
          }
        }

        const allQuestions = await loadOnboardingQuestions()
        if (cancelled) return

        const s1 = allQuestions
          .filter(q => q.stage === 1 && q.active)
          .sort((a, b) => a.order_hint - b.order_hint)
        const s2 = allQuestions
          .filter(q => q.stage === 2 && q.active)
          .sort((a, b) => a.order_hint - b.order_hint)
        const s3 = allQuestions
          .filter(q => q.stage === 3 && q.active)
          .sort((a, b) => a.order_hint - b.order_hint)

        setStage1Questions(s1)
        setStage2Bank(s2)
        setStage3Questions(s3)

        // If we land mid-flow on Stage 2, hydrate from API selection
        if (nextStage === 'stage2') {
          const prepared = await fetchStage2Questions(
            s2,
            'OnboardingWizard: hydrate Stage 2 questions',
          )
          if (!cancelled && prepared) {
            setStage2Questions(prepared)
          }
        }

        // Stage 3 uses static bank; no extra fetch needed here
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'Something went wrong while loading onboarding.'
          setError(msg)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [])

  // Ensure Stage 2 questions exist when we enter Stage 2 (e.g., after selection completes)
  useEffect(() => {
    if (stage !== 'stage2' || stage2Questions.length > 0) return

    let cancelled = false
    void (async () => {
      const prepared = await fetchStage2Questions(
        stage2Bank,
        'OnboardingWizard: ensure Stage 2 questions',
      )
      if (!cancelled && prepared) {
        setStage2Questions(prepared)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [stage, stage2Bank, stage2Questions.length])

  // Track stage view when stage changes (only for in-progress stages)
  useEffect(() => {
    track('onboarding_stage_viewed', { stage })
  }, [stage])

  const handleAnswerChange = useCallback((question: OnboardingQuestion, response: QuestionResponse) => {
    setAnswers(prev => ({ ...prev, [question.id]: response }))
    setInlineError(null)
    track('onboarding_question_answered', { stage, questionId: question.id, type: response.type })
  }, [stage])

  const questions = useMemo(() => {
    if (stage === 'stage1') return stage1Questions
    if (stage === 'stage2') return stage2Questions
    if (stage === 'stage3') return stage3Questions
    return []
  }, [stage, stage1Questions, stage2Questions, stage3Questions])

  const currentQuestion = questions[currentQuestionIndex]

  const stageLengths = useMemo(() => ({
    stage1: stage1Questions.length || DEFAULT_STAGE_LENGTHS.stage1,
    stage2: stage2Questions.length || DEFAULT_STAGE_LENGTHS.stage2,
    stage3: stage3Questions.length || DEFAULT_STAGE_LENGTHS.stage3,
  }), [stage1Questions.length, stage2Questions.length, stage3Questions.length])

  const totalQuestions = stageLengths.stage1 + stageLengths.stage2 + stageLengths.stage3

  const knownQuestionIds = useMemo(() => {
    const ids = new Set<string>()
    stage1Questions.forEach(q => ids.add(q.id))
    stage2Questions.forEach(q => ids.add(q.id))
    stage3Questions.forEach(q => ids.add(q.id))
    return ids
  }, [stage1Questions, stage2Questions, stage3Questions])

  const answeredCount = useMemo(() => {
    return Object.entries(answers).reduce((count, [questionId, response]) => {
      if (!response) return count
      if (knownQuestionIds.size > 0 && !knownQuestionIds.has(questionId)) return count
      return count + 1
    }, 0)
  }, [answers, knownQuestionIds])

  const stageIndex = stageToIndex(stage)

  const overallQuestionNumber = useMemo(() => {
    if (!currentQuestion) return Math.max(answeredCount, 0)
    if (stage === 'stage1') return currentQuestionIndex + 1
    if (stage === 'stage2') return stageLengths.stage1 + currentQuestionIndex + 1
    if (stage === 'stage3') return stageLengths.stage1 + stageLengths.stage2 + currentQuestionIndex + 1
    return totalQuestions
  }, [currentQuestion, currentQuestionIndex, stage, stageLengths, totalQuestions, answeredCount])

  const progressPercent = totalQuestions > 0
    ? Math.round((Math.min(answeredCount, totalQuestions) / totalQuestions) * 100)
    : 0

  const persistAnswer = useCallback(async (
    question: OnboardingQuestion,
    response: QuestionResponse,
  ): Promise<ProgressUpdateResponse | null> => {
    setInlineError(null)
    setSaving(true)
    try {
      const stageKey: OnboardingStage = question.stage === 1 ? 'stage1' : question.stage === 2 ? 'stage2' : 'stage3'
      const payloadBase = {
        stage: stageKey,
        questionId: question.id,
        response,
      } satisfies Omit<ProgressUpdateRequest, 'version'>

      const { response: res } = await withVersionRetry(
        ver => fetch('/api/onboarding/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payloadBase, version: ver }),
        }),
        version,
        setVersion,
      )

      if (!res.ok) {
        const detail = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(detail.error || 'Failed to save response')
      }

      const data = await res.json() as ProgressUpdateResponse
      setVersion(data.state.version)
      const snapshot = data.state.answers_snapshot || {}
      setAnswers(prev => {
        if (Object.keys(snapshot).length > 0) {
          return snapshot
        }
        return { ...prev, [question.id]: response }
      })
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save your response. Please try again.'
      setInlineError(message)
      return null
    } finally {
      setSaving(false)
    }
  }, [version])

  const completeOnboarding = useCallback(async () => {
    setInlineError(null)
    setIsProcessing(true)
    try {
      const { response: res } = await withVersionRetry(
        ver => fetch('/api/onboarding/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version: ver }),
        }),
        version,
        setVersion,
      )

      if (!res.ok) {
        const detail = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(detail.error || 'Failed to finalize onboarding')
      }

      const data = await res.json() as CompletionResponse
      setCompletionSummary(data.summary ?? null)
      setCompletionRedirect(data.redirect)
      setStage('complete')
      setCurrentQuestionIndex(0)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'We had trouble completing onboarding. Please retry.'
      setInlineError(message)
    } finally {
      setIsProcessing(false)
    }
  }, [version])

  const handleNext = useCallback(async () => {
    if (!currentQuestion) return
    const response = answers[currentQuestion.id]
    if (!response) return

    const progress = await persistAnswer(currentQuestion, response)
    if (!progress) return

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(index => index + 1)
      return
    }

    if (stage === 'stage1') {
      const nextQuestions = progress.next?.questions as OnboardingQuestion[] | undefined
      if (nextQuestions && nextQuestions.length > 0) {
        nextQuestions.sort((a, b) => a.order_hint - b.order_hint)
        setStage2Questions(nextQuestions)
      } else if (stage2Bank.length >= 4) {
        setStage2Questions(stage2Bank.slice(0, 4))
      }
      setStage('stage2')
      setCurrentQuestionIndex(0)
      track('onboarding_stage_completed', { stage: 'stage1' })
      return
    }

    if (stage === 'stage2') {
      setStage('stage3')
      setCurrentQuestionIndex(0)
      track('onboarding_stage_completed', { stage: 'stage2' })
      return
    }

    if (stage === 'stage3') {
      track('onboarding_stage_completed', { stage: 'stage3' })
      await completeOnboarding()
    }
  }, [answers, completeOnboarding, currentQuestion, currentQuestionIndex, persistAnswer, questions.length, stage, stage2Bank])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="h-24 w-full animate-pulse rounded bg-muted" />
        <div className="h-24 w-full animate-pulse rounded bg-muted" />
      </div>
    )
  }

  if (error && stage !== 'complete') {
    return (
      <div role="alert" className="rounded border border-destructive/50 bg-destructive/10 p-4 text-sm">
        {error}
      </div>
    )
  }

  if (isProcessing) {
    return <ProcessingState />
  }

  if (stage === 'complete' && completionSummary) {
    return (
      <OnboardingCompletionSummary
        summary={completionSummary}
        onContinue={() => {
          window.location.href = completionRedirect
        }}
      />
    )
  }

  if (!currentQuestion) {
    return (
      <div className="rounded border border-border/40 bg-background/70 p-4 text-sm text-muted-foreground">
        We&apos;ll hold on to what you&apos;ve shared. Please refresh if you&apos;re ready to begin again.
      </div>
    )
  }

  const nextLabel = (() => {
    const lastQuestion = currentQuestionIndex === questions.length - 1
    if (!lastQuestion) return 'Continue'
    if (stage === 'stage1') return "See what's next"
    if (stage === 'stage2') return 'Move to somatic mapping'
    if (stage === 'stage3') return 'See my onboarding summary'
    return 'Continue'
  })()

  return (
    <div className="space-y-6">
      {inlineError ? (
        <div role="alert" className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {inlineError}
        </div>
      ) : null}

      <section aria-labelledby="onboarding-stage">
        <h2 id="onboarding-stage" className="text-lg font-medium">{STAGE_TITLES[stage]}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Select what fits best. Some questions may allow multiple selections.</p>
        <div className="mt-4 space-y-4">
          <QuestionCard
            key={currentQuestion.id}
            question={currentQuestion}
            value={answers[currentQuestion.id]}
            onChange={resp => handleAnswerChange(currentQuestion, resp)}
          />
        </div>
        <WizardFooter
          saving={saving}
          onNext={handleNext}
          nextDisabled={saving || !answers[currentQuestion.id]}
          nextLabel={nextLabel}
          stage={stage}
          stageIndex={stageIndex}
          totalStages={3}
          overallQuestionNumber={overallQuestionNumber}
          totalQuestions={totalQuestions}
          progressPercent={progressPercent}
        />
      </section>
    </div>
  )
}
