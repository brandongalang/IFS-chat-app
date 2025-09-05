"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QuestionCard } from './QuestionCard'
import { WizardFooter } from './WizardFooter'
import { track } from '@/lib/analytics'
import type { OnboardingQuestion, OnboardingStage, ProgressUpdateRequest, ProgressUpdateResponse, QuestionResponse } from '@/lib/onboarding/types'
import { QUESTION_BANK } from '@/lib/onboarding/question-bank'
import { getQuestionsByStage } from '@/lib/onboarding/types'
import { computeStage1Scores } from '@/lib/onboarding/scoring'
import { selectStage2Questions } from '@/lib/onboarding/selector'

interface StateSummary {
  stage: OnboardingStage
  status: 'in_progress' | 'completed'
  version: number
  needs_onboarding: boolean
}

export function OnboardingWizard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [version, setVersion] = useState<number>(0)
  const [stage, setStage] = useState<OnboardingStage>('stage1')

  const [stage1Questions, setStage1Questions] = useState<OnboardingQuestion[]>([])
  const [stage2Questions, setStage2Questions] = useState<OnboardingQuestion[]>([])

  const [answers, setAnswers] = useState<Record<string, QuestionResponse>>({})

  const [saving, setSaving] = useState(false)
  const saveTimer = useRef<number | null>(null)

  // Initial load of state and Stage 1 questions
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        setLoading(true)
        setError(null)

        const stateRes = await fetch('/api/onboarding/state', { cache: 'no-store' })
        if (!stateRes.ok) throw new Error('Failed to load onboarding state')
        const stateData: StateSummary = await stateRes.json()

        setVersion(stateData.version)
        setStage(stateData.stage)

        const questions = getQuestionsByStage(QUESTION_BANK, 1)
        if (!cancelled) setStage1Questions(questions)

        track('onboarding_stage_viewed', { stage: stateData.stage })
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Something went wrong')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  // Debounced save
  const saveProgress = useCallback(async (payload: ProgressUpdateRequest) => {
    setSaving(true)
    try {
      const res = await fetch('/api/onboarding/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.status === 409) {
        // Version conflict — refresh version from server state
        const s = await fetch('/api/onboarding/state', { cache: 'no-store' })
        if (s.ok) {
          const sd: StateSummary = await s.json()
          setVersion(sd.version)
        }
        return
      }

      if (!res.ok) {
        // Non-fatal; keep UI responsive
        return
      }

      const data = await res.json() as ProgressUpdateResponse
      setVersion(data.state.version)

      if (data.next?.stage === 'stage2' && !data.next.questions) {
        setStage('stage2')
        track('onboarding_stage_completed', { stage: 'stage1' })
        track('onboarding_stage_viewed', { stage: 'stage2' })
      }
    } finally {
      setSaving(false)
    }
  }, [])

  const scheduleSave = useCallback((payload: ProgressUpdateRequest) => {
    // 500ms debounce
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void saveProgress(payload)
    }, 500)
  }, [saveProgress])

  // Local answer update + schedule save
  const handleAnswerChange = useCallback((q: OnboardingQuestion, response: QuestionResponse) => {
    setAnswers(prev => ({ ...prev, [q.id]: response }))
    track('onboarding_question_answered', { stage, questionId: q.id, type: response.type })
    scheduleSave({ stage, questionId: q.id, response, version })
  }, [scheduleSave, stage, version])

  const stage1Completion = useMemo(() => {
    const ids = stage1Questions.map(q => q.id)
    return ids.length > 0 && ids.every(id => answers[id] && (answers[id] as any))
  }, [stage1Questions, answers])

  const handleGoToStage2 = useCallback(() => {
    if (!stage1Completion) return

    const stage1Scores = computeStage1Scores(answers)
    const stage2QuestionBank = getQuestionsByStage(QUESTION_BANK, 2)
    const selection = selectStage2Questions(stage1Scores, stage2QuestionBank)
    const selectedQuestions = QUESTION_BANK.filter(q => selection.ids.includes(q.id))

    setStage2Questions(selectedQuestions)
    setStage('stage2')
    track('onboarding_stage_completed', { stage: 'stage1' })
    track('onboarding_stage_viewed', { stage: 'stage2' })
  }, [stage1Completion, answers])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="h-24 w-full animate-pulse rounded bg-muted" />
        <div className="h-24 w-full animate-pulse rounded bg-muted" />
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="rounded border border-destructive/50 bg-destructive/10 p-4 text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {stage === 'stage1' && (
        <section aria-labelledby="s1">
          <h2 id="s1" className="text-lg font-medium">Stage 1 — 5 quick probes</h2>
          <p className="mt-1 text-sm text-muted-foreground">Select what fits best. Some questions may allow multiple selections.</p>
          <div className="mt-4 space-y-4">
            {stage1Questions.map(q => (
              <QuestionCard
                key={q.id}
                question={q}
                value={answers[q.id]}
                onChange={(resp) => handleAnswerChange(q, resp)}
              />
            ))}
          </div>
          <WizardFooter
            saving={saving}
            nextDisabled={!stage1Completion}
            onNext={handleGoToStage2}
          />
        </section>
      )}

      {stage === 'stage2' && (
        <section aria-labelledby="s2">
          <h2 id="s2" className="text-lg font-medium">Stage 2 — A few context questions</h2>
          <p className="mt-1 text-sm text-muted-foreground">These may be personalized based on your earlier answers.</p>
          <div className="mt-4 space-y-4">
            {stage2Questions.map(q => (
              <QuestionCard
                key={q.id}
                question={q}
                value={answers[q.id]}
                onChange={(resp) => handleAnswerChange(q, resp)}
              />
            ))}
          </div>
          <WizardFooter
            saving={saving}
            nextDisabled={!stage2Questions.every(q => !!answers[q.id])}
            onNext={() => {
              // Completion is handled by a separate button in a later iteration
              // For MVP, we can navigate to /today and rely on completion later.
              window.location.href = '/today'
            }}
            nextLabel="Finish"
          />
        </section>
      )}
    </div>
  )
}
