'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { CheckInLayout } from './CheckInLayout'
import { CheckInWizard } from './CheckInWizard'
import { EmojiScale } from './EmojiScale'
import { PartsPicker } from './PartsPicker'
import { MorningSummary } from './MorningSummary'
import { useToast } from '@/hooks/use-toast'
import { submitCheckInAction } from '@/app/check-in/actions'
import {
  DEFAULT_ENERGY_ID,
  DEFAULT_INTENTION_FOCUS_ID,
  DEFAULT_MOOD_ID,
  DEFAULT_EVENING_PROMPT,
  ENERGY_OPTIONS,
  INTENTION_FOCUS_OPTIONS,
  MOOD_OPTIONS,
  findEmojiOption,
  CHECK_IN_DRAFT_PREFIX,
  type MorningContextSummary,
  type PartOption,
} from '@/lib/check-ins/shared'

type MorningState = {
  mood: string
  energy: string
  intentionFocus: string
  mindForToday: string
  intention: string
  parts: string[]
}

type EveningState = {
  mood: string
  energy: string
  intentionFocus: string
  reflection: string
  gratitude: string
  moreNotes: string
  parts: string[]
}

type WizardStepConfig = {
  id: string
  title: string
  description?: string
  validate?: () => string | null
  nextLabel?: string
  submitLabel?: string
  render: () => ReactNode
}

interface CheckInExperienceProps {
  variant: 'morning' | 'evening'
  parts: PartOption[]
  targetDateIso: string
  streakDays?: number
  morningContext?: MorningContextSummary | null
}

const MORNING_DEFAULTS: MorningState = {
  mood: DEFAULT_MOOD_ID,
  energy: DEFAULT_ENERGY_ID,
  intentionFocus: DEFAULT_INTENTION_FOCUS_ID,
  mindForToday: '',
  intention: '',
  parts: [],
}

function createEveningDefaults(context?: MorningContextSummary | null): EveningState {
  return {
    mood: context ? context.emoji.mood.id : DEFAULT_MOOD_ID,
    energy: context ? context.emoji.energy.id : DEFAULT_ENERGY_ID,
    intentionFocus: context ? context.emoji.intentionFocus.id : DEFAULT_INTENTION_FOCUS_ID,
    reflection: '',
    gratitude: '',
    moreNotes: '',
    parts: context ? [...context.parts] : [],
  }
}

export function CheckInExperience({
  variant,
  parts,
  targetDateIso,
  streakDays,
  morningContext = null,
}: CheckInExperienceProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [stepIndex, setStepIndex] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionStatus, setActionStatus] = useState<'idle' | 'pending' | 'success'>('idle')
  const [morningState, setMorningState] = useState<MorningState>(MORNING_DEFAULTS)
  const eveningDefaults = useMemo(() => createEveningDefaults(morningContext), [morningContext])
  const [eveningState, setEveningState] = useState<EveningState>(() => eveningDefaults)
  const successResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (variant === 'evening') {
      setEveningState((prev) => (isEveningDraftDirty(prev, eveningDefaults) ? prev : eveningDefaults))
    }
  }, [eveningDefaults, variant])

  const flashSuccess = useCallback(() => {
    if (successResetRef.current) {
      clearTimeout(successResetRef.current)
    }
    setActionStatus('success')
    successResetRef.current = setTimeout(() => {
      setActionStatus('idle')
      successResetRef.current = null
    }, 900)
  }, [])

  useEffect(() => {
    return () => {
      if (successResetRef.current) {
        clearTimeout(successResetRef.current)
      }
    }
  }, [])

  const partLookup = useMemo(() => {
    const map = new Map<string, PartOption>()
    for (const part of parts) {
      map.set(part.id, part)
    }
    return map
  }, [parts])

  const draftKey = `${CHECK_IN_DRAFT_PREFIX}-${variant}-${targetDateIso}`

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        variant: 'morning' | 'evening'
        state: MorningState | EveningState
      }
      if (parsed.variant !== variant) return
      if (variant === 'morning') {
        setMorningState({ ...MORNING_DEFAULTS, ...(parsed.state as MorningState) })
      } else {
        setEveningState({ ...eveningDefaults, ...(parsed.state as EveningState) })
      }
    } catch (error) {
      console.warn('Failed to parse check-in draft', error)
    }
  }, [draftKey, variant, eveningDefaults])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (variant === 'morning') {
      if (!isMorningDraftDirty(morningState)) {
        localStorage.removeItem(draftKey)
        return
      }
      try {
        const serialized = JSON.stringify({ variant, state: morningState })
        localStorage.setItem(draftKey, serialized)
        window.dispatchEvent(new StorageEvent('storage', { key: draftKey, newValue: serialized }))
      } catch (error) {
        console.warn('Failed to persist check-in draft', error)
      }
      return
    }

    if (!isEveningDraftDirty(eveningState, eveningDefaults)) {
      localStorage.removeItem(draftKey)
      return
    }

    try {
      const serialized = JSON.stringify({ variant, state: eveningState })
      localStorage.setItem(draftKey, serialized)
      window.dispatchEvent(new StorageEvent('storage', { key: draftKey, newValue: serialized }))
    } catch (error) {
      console.warn('Failed to persist check-in draft', error)
    }
  }, [draftKey, variant, morningState, eveningState, eveningDefaults])

  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(draftKey)
      window.dispatchEvent(new StorageEvent('storage', { key: draftKey, newValue: null }))
    } catch (error) {
      console.warn('Failed to clear check-in draft', error)
    }
  }, [draftKey])

  const steps = useMemo<WizardStepConfig[]>(() => {
    if (variant === 'morning') {
      return [
        {
          id: 'arrive',
          title: 'How are you arriving?',
          description: 'Check in with your body before naming the day.',
          nextLabel: 'Continue',
          render: () => (
            <div className="grid gap-4">
              <EmojiScale
                label="How are you feeling right now?"
                options={MOOD_OPTIONS}
                value={morningState.mood}
                onChange={(value) => setMorningState((prev) => ({ ...prev, mood: value }))}
              />
              <EmojiScale
                label="How much energy do you have?"
                options={ENERGY_OPTIONS}
                value={morningState.energy}
                onChange={(value) => setMorningState((prev) => ({ ...prev, energy: value }))}
              />
              <EmojiScale
                label="How anchored do you feel in your intention?"
                options={INTENTION_FOCUS_OPTIONS}
                value={morningState.intentionFocus}
                onChange={(value) => setMorningState((prev) => ({ ...prev, intentionFocus: value }))}
              />
            </div>
          ),
        },
        {
          id: 'focus',
          title: 'Name what matters today',
          description: 'Capture the threads you want to hold onto.',
          nextLabel: 'Review',
          validate: () => {
            if (!morningState.intention.trim()) {
              return 'Your intention helps guide the day. Add a quick note before continuing.'
            }
            return null
          },
          render: () => (
            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="mindForToday">What’s on your mind for today?</Label>
                <Textarea
                  id="mindForToday"
                  placeholder="Upcoming conversations, hopes, or worries."
                  value={morningState.mindForToday}
                  onChange={(event) =>
                    setMorningState((prev) => ({ ...prev, mindForToday: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="intention">What’s your intention for today?</Label>
                <Textarea
                  id="intention"
                  placeholder="e.g., Stay grounded and curious."
                  value={morningState.intention}
                  onChange={(event) =>
                    setMorningState((prev) => ({ ...prev, intention: event.target.value }))
                  }
                  required
                />
              </div>
              <PartsPicker
                label="Any parts feel active?"
                options={parts}
                selectedIds={morningState.parts}
                onToggle={(id) =>
                  setMorningState((prev) => ({
                    ...prev,
                    parts: prev.parts.includes(id)
                      ? prev.parts.filter((value) => value !== id)
                      : [...prev.parts, id],
                  }))
                }
              />
            </div>
          ),
        },
        {
          id: 'review',
          title: 'Take a breath and confirm',
          description: 'Make sure this reflects what you want to carry forward.',
          submitLabel: 'Complete check-in',
          render: () => <MorningReview state={morningState} partLookup={partLookup} />,
        },
      ]
    }

    return [
      {
        id: 'arrive',
        title: 'How are you landing tonight?',
        description: 'Notice what shifted since the morning.',
        nextLabel: 'Continue',
        render: () => (
          <div className="grid gap-4">
            <EmojiScale
              label="How are you feeling right now?"
              options={MOOD_OPTIONS}
              value={eveningState.mood}
              onChange={(value) => setEveningState((prev) => ({ ...prev, mood: value }))}
            />
            <EmojiScale
              label="How much energy do you have?"
              options={ENERGY_OPTIONS}
              value={eveningState.energy}
              onChange={(value) => setEveningState((prev) => ({ ...prev, energy: value }))}
            />
            <EmojiScale
              label="How anchored do you feel in your intention?"
              options={INTENTION_FOCUS_OPTIONS}
              value={eveningState.intentionFocus}
              onChange={(value) => setEveningState((prev) => ({ ...prev, intentionFocus: value }))}
            />
          </div>
        ),
      },
      {
        id: 'reflect',
        title: 'Reflect with curiosity',
        description: 'Capture what stood out and any gratitude you want to hold.',
        nextLabel: 'Review',
        validate: () => {
          if (!morningContext) {
            return 'We couldn’t load your morning check-in. Try refreshing the page.'
          }
          if (!eveningState.reflection.trim()) {
            return 'A brief reflection helps close the loop. Add a thought before continuing.'
          }
          return null
        },
        render: () => (
          <div className="grid gap-6">
            {morningContext ? (
              <MorningSummary context={morningContext} partLookup={partLookup} />
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="reflection">{morningContext?.generatedPrompt ?? DEFAULT_EVENING_PROMPT}</Label>
              <Textarea
                id="reflection"
                placeholder="Capture what shifted, surprised, or felt meaningful."
                value={eveningState.reflection}
                onChange={(event) =>
                  setEveningState((prev) => ({ ...prev, reflection: event.target.value }))
                }
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gratitude">Anything you’re grateful for? (optional)</Label>
              <Textarea
                id="gratitude"
                placeholder="A moment of appreciation or ease."
                value={eveningState.gratitude}
                onChange={(event) =>
                  setEveningState((prev) => ({ ...prev, gratitude: event.target.value }))
                }
              />
            </div>
            <PartsPicker
              label="Which parts felt active?"
              options={parts}
              selectedIds={eveningState.parts}
              onToggle={(id) =>
                setEveningState((prev) => ({
                  ...prev,
                  parts: prev.parts.includes(id)
                    ? prev.parts.filter((value) => value !== id)
                    : [...prev.parts, id],
                }))
              }
            />
            <div className="grid gap-2">
              <Label htmlFor="moreNotes">Anything else you want to capture?</Label>
              <Textarea
                id="moreNotes"
                placeholder="Wins, lingering parts, or messages to future you."
                value={eveningState.moreNotes}
                onChange={(event) =>
                  setEveningState((prev) => ({ ...prev, moreNotes: event.target.value }))
                }
              />
            </div>
          </div>
        ),
      },
      {
        id: 'review',
        title: 'Slow down and send',
        description: 'Give the day a gentle closure.',
        submitLabel: 'Complete review',
        render: () => (
          <EveningReview
            state={eveningState}
            partLookup={partLookup}
            morningContext={morningContext}
          />
        ),
      },
    ]
  }, [variant, morningState, eveningState, parts, partLookup, morningContext])

  const currentStep = steps[stepIndex]
  const isLastStep = stepIndex === steps.length - 1

  const handleBack = useCallback(() => {
    setFormError(null)
    setSubmitError(null)
    setActionStatus('idle')
    setStepIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  const handleAdvance = useCallback(async () => {
    setFormError(null)
    setSubmitError(null)
    setActionStatus('pending')

    const validationError = currentStep.validate?.()
    if (validationError) {
      setFormError(validationError)
      setActionStatus('idle')
      return
    }

    if (!isLastStep) {
      setStepIndex((prev) => Math.min(prev + 1, steps.length - 1))
      flashSuccess()
      return
    }

    setIsSubmitting(true)
    let completed = false
    try {
      const payload = variant === 'morning'
        ? {
            type: 'morning' as const,
            mood: morningState.mood,
            energy: morningState.energy,
            intentionFocus: morningState.intentionFocus,
            mindForToday: morningState.mindForToday.trim(),
            intention: morningState.intention.trim(),
            parts: morningState.parts,
          }
        : {
            type: 'evening' as const,
            mood: eveningState.mood,
            energy: eveningState.energy,
            intentionFocus: eveningState.intentionFocus,
            reflectionPrompt: morningContext?.generatedPrompt ?? DEFAULT_EVENING_PROMPT,
            reflection: eveningState.reflection.trim(),
            gratitude: eveningState.gratitude.trim(),
            moreNotes: eveningState.moreNotes.trim(),
            parts: eveningState.parts,
          }

      const payloadWithDate = { ...payload, targetDateIso }
      const result = await submitCheckInAction(payloadWithDate)

      if (!result.ok) {
        if (result.conflict) {
          setSubmitError(result.error ?? 'Looks like this check-in is already complete for today.')
          toast({
            title: 'Already complete',
            description: 'You’ve already filled this check-in today. Redirecting you home.',
            variant: 'default',
          })
          clearDraft()
          router.push('/')
          return
        }

        setSubmitError(result.error ?? 'Failed to save your check-in. Please try again.')
        toast({
          title: 'Unable to save',
          description: result.error ?? 'Something went wrong.',
          variant: 'destructive',
        })
        setActionStatus('idle')
        return
      }

      completed = true
      flashSuccess()
      toast({
        title: variant === 'morning' ? 'Morning check-in saved' : 'Evening reflection saved',
        description:
          variant === 'morning'
            ? 'Come back this evening to see how things unfolded.'
            : 'You closed the loop for today—rest well.',
      })
      clearDraft()
      router.push('/')
    } finally {
      setIsSubmitting(false)
      if (!completed) {
        setActionStatus('idle')
      }
    }
  }, [
    currentStep,
    isLastStep,
    steps.length,
    variant,
    morningState,
    eveningState,
    morningContext,
    toast,
    clearDraft,
    router,
    flashSuccess,
    targetDateIso,
  ])

  return (
    <CheckInLayout
      variant={variant}
      stepTitle={currentStep.title}
      stepDescription={currentStep.description}
      progress={(stepIndex + 1) / steps.length}
      streakDays={streakDays}
      error={formError ?? submitError}
    >
      <CheckInWizard
        onBack={stepIndex > 0 ? handleBack : undefined}
        onNext={handleAdvance}
        disableNext={isSubmitting}
        isLastStep={isLastStep}
        nextLabel={currentStep.nextLabel}
        submitLabel={currentStep.submitLabel}
        status={actionStatus}
      >
        {currentStep.render()}
      </CheckInWizard>
    </CheckInLayout>
  )
}

function MorningReview({ state, partLookup }: { state: MorningState; partLookup: Map<string, PartOption> }) {
  const mood = findEmojiOption('mood', state.mood)
  const energy = findEmojiOption('energy', state.energy)
  const intentionFocus = findEmojiOption('intentionFocus', state.intentionFocus)
  const parts = state.parts.map((id) => partLookup.get(id)).filter((part): part is PartOption => Boolean(part))

  return (
    <div className="grid gap-5 text-sm">
      <section className="grid gap-2">
        <h2 className="text-base font-medium">Mood & energy</h2>
        <div className="flex flex-wrap gap-3 text-xl">
          <Chip label={mood.label} emoji={mood.emoji} />
          <Chip label={energy.label} emoji={energy.emoji} />
          <Chip label={intentionFocus.label} emoji={intentionFocus.emoji} />
        </div>
      </section>
      <section className="grid gap-1">
        <h2 className="text-base font-medium">Mind for today</h2>
        <p className="text-muted-foreground leading-relaxed">
          {state.mindForToday.trim().length > 0 ? state.mindForToday : 'You’ll start the day with a blank slate.'}
        </p>
      </section>
      <section className="grid gap-1">
        <h2 className="text-base font-medium">Intention</h2>
        <p className="text-foreground leading-relaxed">{state.intention.trim()}</p>
      </section>
      <section className="grid gap-2">
        <h2 className="text-base font-medium">Parts to watch</h2>
        {parts.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {parts.map((part) => (
              <span key={part.id} className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-3 py-1">
                <span aria-hidden>{part.emoji ?? '🧩'}</span>
                <span className="text-xs font-medium">{part.name}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No specific parts named yet.</p>
        )}
      </section>
    </div>
  )
}

function EveningReview({
  state,
  partLookup,
  morningContext,
}: {
  state: EveningState
  partLookup: Map<string, PartOption>
  morningContext: MorningContextSummary | null
}) {
  const mood = findEmojiOption('mood', state.mood)
  const energy = findEmojiOption('energy', state.energy)
  const intentionFocus = findEmojiOption('intentionFocus', state.intentionFocus)
  const parts = state.parts.map((id) => partLookup.get(id)).filter((part): part is PartOption => Boolean(part))

  return (
    <div className="grid gap-5 text-sm">
      <section className="grid gap-2">
        <h2 className="text-base font-medium">Mood & energy</h2>
        <div className="flex flex-wrap gap-3 text-xl">
          <Chip label={mood.label} emoji={mood.emoji} />
          <Chip label={energy.label} emoji={energy.emoji} />
          <Chip label={intentionFocus.label} emoji={intentionFocus.emoji} />
        </div>
      </section>
      {morningContext ? (
        <section className="grid gap-1">
          <h2 className="text-base font-medium">Evening prompt</h2>
          <p className="italic text-muted-foreground">“{morningContext.generatedPrompt}”</p>
        </section>
      ) : null}
      <section className="grid gap-1">
        <h2 className="text-base font-medium">Reflection</h2>
        <p className="text-foreground leading-relaxed">{state.reflection.trim()}</p>
      </section>
      {state.gratitude.trim().length > 0 ? (
        <section className="grid gap-1">
          <h2 className="text-base font-medium">Gratitude</h2>
          <p className="text-muted-foreground leading-relaxed">{state.gratitude.trim()}</p>
        </section>
      ) : null}
      {state.moreNotes.trim().length > 0 ? (
        <section className="grid gap-1">
          <h2 className="text-base font-medium">Notes to remember</h2>
          <p className="text-muted-foreground leading-relaxed">{state.moreNotes.trim()}</p>
        </section>
      ) : null}
      <section className="grid gap-2">
        <h2 className="text-base font-medium">Parts you noticed</h2>
        {parts.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {parts.map((part) => (
              <span key={part.id} className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-3 py-1">
                <span aria-hidden>{part.emoji ?? '🧩'}</span>
                <span className="text-xs font-medium">{part.name}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No parts were highlighted this evening.</p>
        )}
      </section>
    </div>
  )
}

function Chip({ label, emoji }: { label: string; emoji: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-sm">
      <span aria-hidden>{emoji}</span>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </span>
  )
}

function isMorningDraftDirty(state: MorningState): boolean {
  return (
    state.mood !== MORNING_DEFAULTS.mood ||
    state.energy !== MORNING_DEFAULTS.energy ||
    state.intentionFocus !== MORNING_DEFAULTS.intentionFocus ||
    state.mindForToday.trim().length > 0 ||
    state.intention.trim().length > 0 ||
    state.parts.length > 0
  )
}

function isEveningDraftDirty(state: EveningState, defaults: EveningState): boolean {
  return (
    state.mood !== defaults.mood ||
    state.energy !== defaults.energy ||
    state.intentionFocus !== defaults.intentionFocus ||
    state.reflection.trim().length > 0 ||
    state.gratitude.trim().length > 0 ||
    state.moreNotes.trim().length > 0 ||
    state.parts.length > 0
  )
}
