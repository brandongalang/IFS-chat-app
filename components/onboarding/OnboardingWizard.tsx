"use client"

import { useCallback, useEffect, useState } from 'react'
import { QuestionCard } from './QuestionCard'
import { WizardFooter } from './WizardFooter'
import { track } from '@/lib/analytics'
import {
  OnboardingQuestion as OnboardingQuestionSchema,
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

export function OnboardingWizard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [version, setVersion] = useState<number>(0)
  const [stage, setStage] = useState<OnboardingStage>('stage1')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)

  const [stage1Questions, setStage1Questions] = useState<OnboardingQuestion[]>([])
  const [stage2Questions, setStage2Questions] = useState<OnboardingQuestion[]>([])
  const [stage3Questions, setStage3Questions] = useState<OnboardingQuestion[]>([])

  const [answers, setAnswers] = useState<Record<string, QuestionResponse>>({})


  // Initial load of state and Stage 1 questions (from local JSON)
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        setLoading(true)
        setError(null)

        const stateRes = await fetch('/api/onboarding/state', { cache: 'no-store' })
        if (stateRes.ok) {
          const stateData: StateSummary = await stateRes.json()
          setVersion(stateData.version)
          setStage(stateData.stage)
        } else {
          // Allow dev persona or unauthenticated to proceed
          setVersion(0)
          setStage('stage1')
        }

        const allQuestions = await loadOnboardingQuestions()
        const s1 = allQuestions.filter(q => q.stage === 1 && q.active).sort((a,b)=>a.order_hint-b.order_hint)
        if (!cancelled) setStage1Questions(s1)

      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'Something went wrong'
          setError(msg)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  // Track stage view when stage changes
  useEffect(() => {
    track('onboarding_stage_viewed', { stage })
  }, [stage])



  // Local answer update + schedule save
  const handleAnswerChange = useCallback((q: OnboardingQuestion, response: QuestionResponse) => {
    setAnswers(prev => ({ ...prev, [q.id]: response }))
    track('onboarding_question_answered', { stage, questionId: q.id, type: response.type })
  }, [stage])

  // Stage 2 questions will be computed client-side on transition from Stage 1

  const questions = stage === 'stage1' ? stage1Questions : stage === 'stage2' ? stage2Questions : stage3Questions
  const currentQuestion = questions[currentQuestionIndex]

  async function saveAllForStage(target: OnboardingStage) {
    // Get questions for the target stage from local JSON or cached state
    const allQuestions = await loadOnboardingQuestions()
    const bank = allQuestions.filter(q => (q.stage === 1 && target==='stage1') || (q.stage===2 && target==='stage2') || (q.stage===3 && target==='stage3'))
    // sequential saves with 409 retry
    const doPost = async (v: number, payload: ProgressUpdateRequest) => fetch('/api/onboarding/progress', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) })
    let currentVersion = version
    for (const q of bank) {
      const resp = answers[q.id]
      if (!resp) continue
      const payload = { stage: target, questionId: q.id, response: resp, version: currentVersion }
      let res = await doPost(currentVersion, payload)
      if (res.status === 409) {
        const s = await fetch('/api/onboarding/state', { cache:'no-store' })
        if (s.ok) {
          const sd: StateSummary = await s.json()
          currentVersion = sd.version
          setVersion(sd.version)
          res = await doPost(currentVersion, { ...payload, version: currentVersion })
        }
      }
      if (res.ok) {
        const data = await res.json() as ProgressUpdateResponse
        currentVersion = data.state.version
        setVersion(data.state.version)
      }
    }
    return currentVersion
  }

  const handleNext = async () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
      if (stage === 'stage1') {
        await saveAllForStage('stage1')
        // Compute Stage 1 scores and select Stage 2 questions from local JSON
        try {
          const allQuestions = await loadOnboardingQuestions()
          const stage2Bank = allQuestions.filter(q => q.stage === 2 && q.active)
          const scoringMod = await import('@/lib/onboarding/scoring')
          const selectorMod = await import('@/lib/onboarding/selector')
          const stage1Scores = scoringMod.computeStage1Scores(answers)
          const selection = selectorMod.selectStage2Questions(stage1Scores, stage2Bank)

          // Persist selection and advance stage on server (version-aware)
          const doPost = async (v: number) => fetch('/api/onboarding/selection', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ version: v, ids: selection.ids })
          })
          let res = await doPost(version)
          if (res.status === 409) {
            const s = await fetch('/api/onboarding/state', { cache: 'no-store' })
            if (s.ok) {
              const sd: StateSummary = await s.json()
              setVersion(sd.version)
              res = await doPost(sd.version)
            }
          }
          // Regardless of response, proceed locally (server will catch up)
          const selectedQuestions = stage2Bank.filter(q => selection.ids.includes(q.id)).sort((a,b)=>a.order_hint-b.order_hint)
          setStage2Questions(selectedQuestions)
          setStage('stage2')
          setCurrentQuestionIndex(0)
        } catch {
          // Fallback: just move to stage2 with first four questions if selection failed
          const allQuestions = await loadOnboardingQuestions()
          const stage2Bank = allQuestions.filter(q => q.stage === 2 && q.active).slice(0,4)
          setStage2Questions(stage2Bank)
          setStage('stage2')
          setCurrentQuestionIndex(0)
        }
      } else if (stage === 'stage2') {
        await saveAllForStage('stage2')
        // Load Stage 3 locally
        const allQuestions = await loadOnboardingQuestions()
        const s3 = allQuestions.filter(q => q.stage===3 && q.active).sort((a,b)=>a.order_hint-b.order_hint)
        setStage3Questions(s3)
        setStage('stage3')
        setCurrentQuestionIndex(0)
      } else if (stage === 'stage3') {
        await saveAllForStage('stage3')
        // Complete onboarding
        const complete = async (v: number) => fetch('/api/onboarding/complete', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ version: v }) })
        let res = await complete(version)
        if (res.status === 409) {
          const s = await fetch('/api/onboarding/state', { cache: 'no-store' })
          if (s.ok) {
            const sd: StateSummary = await s.json()
            setVersion(sd.version)
            res = await complete(sd.version)
          }
        }
        if (res.ok) {
          const data = await res.json() as { redirect: string }
          window.location.href = data.redirect
        }
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
    stage3: 'Stage 3 — Somatic & Belief Mapping',
    complete: 'Onboarding Complete',
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
          saving={false}
          onNext={handleNext}
          nextDisabled={!currentQuestion || !answers[currentQuestion.id]}
          nextLabel={currentQuestionIndex === questions.length - 1 && (stage === 'stage2' || stage === 'stage3') ? 'Finish' : 'Continue'}
          totalQuestions={questions.length}
          currentQuestionIndex={currentQuestionIndex}
        />
      </section>
    </div>
  )
}
