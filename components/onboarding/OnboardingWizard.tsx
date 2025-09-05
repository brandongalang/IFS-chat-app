"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuestionCard } from './QuestionCard'
import { WizardFooter } from './WizardFooter'
import { track } from '@/lib/analytics'
import type { OnboardingQuestion, OnboardingStage, ProgressUpdateRequest, ProgressUpdateResponse, QuestionResponse } from '@/lib/onboarding/types'

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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)

  const [stage1Questions, setStage1Questions] = useState<OnboardingQuestion[]>([])
  const [stage2Questions, setStage2Questions] = useState<OnboardingQuestion[]>([])

  const [answers, setAnswers] = useState<Record<string, QuestionResponse>>({})

  const [saving, setSaving] = useState(false)
  const saveTimer = useRef<number | null>(null)
  const router = useRouter()

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

        const q1Res = await fetch('/api/onboarding/questions?stage=1', { cache: 'no-store' })
        if (!q1Res.ok) throw new Error('Failed to load Stage 1 questions')
        const q1Data = await q1Res.json() as { questions: OnboardingQuestion[] }
        if (!cancelled) setStage1Questions(q1Data.questions)

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

      if (data.next?.stage === 'stage2' && data.next.questions) {
        setStage('stage2')
        setStage2Questions(data.next.questions)
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

  // If user reaches stage2 and questions not fetched via progress, fetch explicitly
  useEffect(() => {
    let cancelled = false
    async function fetchStage2() {
      if (stage !== 'stage2' || stage2Questions.length > 0) return
      try {
        const res = await fetch('/api/onboarding/questions?stage=2', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json() as { questions: OnboardingQuestion[] }
        if (!cancelled) setStage2Questions(data.questions)
      } catch {}
    }
    void fetchStage2()
    return () => { cancelled = true }
  }, [stage, stage2Questions.length])

  const questions = stage === 'stage1' ? stage1Questions : stage2Questions
  const currentQuestion = questions[currentQuestionIndex]

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
      // Advance to next stage or finish
      if (stage === 'stage1') {
        setStage('stage2')
        setCurrentQuestionIndex(0)
      } else {
        router.push('/today')
      }
    }
  }

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

  const stageTitles: Record<OnboardingStage, string> = {
    stage1: 'Stage 1 — 5 quick probes',
    stage2: 'Stage 2 — A few context questions',
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="s1">
        <h2 id="s1" className="text-lg font-medium">{stageTitles[stage]}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Select what fits best. Some questions may allow multiple selections.</p>
        <div className="mt-4 space-y-4">
          {currentQuestion && (
            <QuestionCard
              key={currentQuestion.id}
              question={currentQuestion}
              value={answers[currentQuestion.id]}
              onChange={(resp) => handleAnswerChange(currentQuestion, resp)}
            />
          )}
        </div>
        <WizardFooter
          saving={saving}
          onNext={handleNext}
          nextDisabled={!currentQuestion || !answers[currentQuestion.id]}
          nextLabel={currentQuestionIndex === questions.length - 1 && stage === 'stage2' ? 'Finish' : 'Continue'}
          totalQuestions={questions.length}
          currentQuestionIndex={currentQuestionIndex}
        />
      </section>
    </div>
  )
}
