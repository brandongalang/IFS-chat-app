'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { CheckInLayout } from './CheckInLayout'
import { CheckInWizard } from './CheckInWizard'
import { EmojiScale } from './EmojiScale'
import { PartsPicker } from './PartsPicker'
import { useToast } from '@/hooks/use-toast'
import { submitCheckInAction } from '@/app/check-in/actions'
import {
  DEFAULT_ENERGY_ID,
  DEFAULT_MOOD_ID,
  DEFAULT_EVENING_PROMPT,
  ENERGY_OPTIONS,
  MOOD_OPTIONS,
  CHECK_IN_DRAFT_PREFIX,
  type MorningContextSummary,
  type PartOption,
} from '@/lib/check-ins/shared'

type MorningState = {
  mood: string
  energy: string
  mindForToday: string
  intention: string
  parts: string[]
}

type EveningState = {
  mood: string
  energy: string
  reflection: string
  wins: string
  gratitude: string
  parts: string[]
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
  mindForToday: '',
  intention: '',
  parts: [],
}

function createEveningDefaults(context?: MorningContextSummary | null): EveningState {
  return {
    mood: context ? context.emoji.mood.id : DEFAULT_MOOD_ID,
    energy: context ? context.emoji.energy.id : DEFAULT_ENERGY_ID,
    reflection: '',
    wins: '',
    gratitude: '',
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
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionStatus, setActionStatus] = useState<'idle' | 'pending' | 'success'>('idle')
  const [morningState, setMorningState] = useState<MorningState>(MORNING_DEFAULTS)
  const eveningDefaults = useMemo(() => createEveningDefaults(morningContext), [morningContext])
  const [eveningState, setEveningState] = useState<EveningState>(() => eveningDefaults)
  useEffect(() => {
    if (variant === 'evening') {
      setEveningState((prev) => (isEveningDraftDirty(prev, eveningDefaults) ? prev : eveningDefaults))
    }
  }, [eveningDefaults, variant])

  // When a save succeeds, briefly show success state then reset back to idle
  useEffect(() => {
    if (actionStatus !== 'success') return
    const timer = setTimeout(() => {
      setActionStatus('idle')
    }, 2000)
    return () => clearTimeout(timer)
  }, [actionStatus])

  const draftKey = `${CHECK_IN_DRAFT_PREFIX}-${variant}-${targetDateIso}`

  // Hydrate from localStorage
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

  // Auto-save to localStorage
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

  const handleCancel = useCallback(() => {
    router.push('/')
  }, [router])

  const handleSave = useCallback(async () => {
    setFormError(null)
    setActionStatus('pending')

    // Validate required fields
    if (variant === 'morning' && !morningState.intention.trim()) {
      setFormError('Your intention helps guide the day. Please add one before saving.')
      setActionStatus('idle')
      return
    }

    if (variant === 'evening') {
      if (!eveningState.reflection.trim()) {
        setFormError('A brief reflection helps close the loop. Please add one before saving.')
        setActionStatus('idle')
        return
      }
      if (!eveningState.wins.trim()) {
        setFormError('Naming at least one win helps build positive momentum. What went well today?')
        setActionStatus('idle')
        return
      }
      if (!eveningState.gratitude.trim()) {
        setFormError('Gratitude practice is part of closing the day. What are you grateful for?')
        setActionStatus('idle')
        return
      }
    }

    setIsSubmitting(true)
    let completed = false
    try {
      const payload =
        variant === 'morning'
          ? {
              type: 'morning' as const,
              mood: morningState.mood,
              energy: morningState.energy,
              mindForToday: morningState.mindForToday.trim(),
              intention: morningState.intention.trim(),
              parts: morningState.parts,
            }
          : {
              type: 'evening' as const,
              mood: eveningState.mood,
              energy: eveningState.energy,
              reflectionPrompt: morningContext?.generatedPrompt ?? DEFAULT_EVENING_PROMPT,
              reflection: eveningState.reflection.trim(),
              wins: eveningState.wins.trim(),
              gratitude: eveningState.gratitude.trim(),
              parts: eveningState.parts,
            }

      const payloadWithDate = { ...payload, targetDateIso }
      const result = await submitCheckInAction(payloadWithDate)

      if (!result.ok) {
        if (result.conflict) {
          setFormError(result.error ?? 'Looks like this check-in is already complete for today.')
          toast({
            title: 'Already complete',
            description: 'You&apos;ve already filled this check-in today. Redirecting you home.',
            variant: 'default',
          })
          clearDraft()
          router.push('/')
          return
        }

        setFormError(result.error ?? 'Failed to save your check-in. Please try again.')
        toast({
          title: 'Unable to save',
          description: result.error ?? 'Something went wrong.',
          variant: 'destructive',
        })
        setActionStatus('idle')
        return
      }

      completed = true
      setActionStatus('success')
      toast({
        title: variant === 'morning' ? 'Morning check-in saved' : 'Evening reflection saved',
        description:
          variant === 'morning'
            ? 'Come back this evening to see how things unfolded.'
            : 'You closed the loop for today—rest well.',
      })
      clearDraft()
      router.push('/')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      setFormError(message)
      toast({
        title: 'Unable to save',
        description: message,
        variant: 'destructive',
      })
      setActionStatus('idle')
    } finally {
      setIsSubmitting(false)
      if (!completed) {
        setActionStatus('idle')
      }
    }
  }, [
    variant,
    morningState,
    eveningState,
    morningContext,
    targetDateIso,
    toast,
    clearDraft,
    router,
  ])

  const canSave =
    variant === 'morning'
      ? morningState.intention.trim().length > 0
      : eveningState.reflection.trim().length > 0 &&
        eveningState.wins.trim().length > 0 &&
        eveningState.gratitude.trim().length > 0

  return (
    <CheckInLayout variant={variant} streakDays={streakDays} error={formError}>
      <CheckInWizard
        onCancel={handleCancel}
        onSave={handleSave}
        isSaving={isSubmitting}
        canSave={canSave}
        saveLabel={variant === 'morning' ? 'Save check-in' : 'Save reflection'}
        status={actionStatus}
      >
        {variant === 'morning' ? (
          <MorningForm state={morningState} setState={setMorningState} parts={parts} />
        ) : (
          <EveningForm
            state={eveningState}
            setState={setEveningState}
            parts={parts}
            morningContext={morningContext}
          />
        )}
      </CheckInWizard>
    </CheckInLayout>
  )
}

// Morning Form Component
interface MorningFormProps {
  state: MorningState
  setState: React.Dispatch<React.SetStateAction<MorningState>>
  parts: PartOption[]
}

function MorningForm({ state, setState, parts }: MorningFormProps) {
  const [showParts, setShowParts] = useState(state.parts.length > 0)

  return (
    <>
      <FormSection title="How are you arriving?">
        <div className="grid gap-3 md:gap-5">
          <EmojiScale
            label="How are you feeling right now?"
            options={MOOD_OPTIONS}
            value={state.mood}
            onChange={(value) => setState((prev) => ({ ...prev, mood: value }))}
          />
          <EmojiScale
            label="How much energy do you have?"
            options={ENERGY_OPTIONS}
            value={state.energy}
            onChange={(value) => setState((prev) => ({ ...prev, energy: value }))}
          />
        </div>
      </FormSection>

      <Separator className="my-6" />

      <FormSection title="Set your intention">
        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="intention" className="text-sm font-medium">
              What&apos;s one thing you want to bring to today? <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="intention"
              placeholder="e.g., Stay grounded and curious"
              value={state.intention}
              onChange={(event) => setState((prev) => ({ ...prev, intention: event.target.value }))}
              rows={3}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mindForToday" className="text-sm font-medium text-muted-foreground">
              What&apos;s on your mind? (optional)
            </Label>
            <Textarea
              id="mindForToday"
              placeholder="Upcoming conversations, hopes, or worries"
              value={state.mindForToday}
              onChange={(event) => setState((prev) => ({ ...prev, mindForToday: event.target.value }))}
              rows={3}
            />
          </div>
        </div>
      </FormSection>

      <Separator className="my-6" />

      <FormSection title="Notice your parts">
        {!showParts ? (
          <button
            type="button"
            onClick={() => setShowParts(true)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
          >
            + Add parts that feel active right now
          </button>
        ) : (
          <PartsPicker
            label="Any parts feel active?"
            options={parts}
            selectedIds={state.parts}
            onToggle={(id) =>
              setState((prev) => ({
                ...prev,
                parts: prev.parts.includes(id) ? prev.parts.filter((value) => value !== id) : [...prev.parts, id],
              }))
            }
          />
        )}
      </FormSection>
    </>
  )
}

// Evening Form Component
interface EveningFormProps {
  state: EveningState
  setState: React.Dispatch<React.SetStateAction<EveningState>>
  parts: PartOption[]
  morningContext: MorningContextSummary | null
}

function EveningForm({ state, setState, parts, morningContext }: EveningFormProps) {
  const [showParts, setShowParts] = useState(state.parts.length > 0)

  return (
    <>
      <FormSection title="How are you landing tonight?">
        <div className="grid gap-3 md:gap-5">
          <EmojiScale
            label="How are you feeling right now?"
            options={MOOD_OPTIONS}
            value={state.mood}
            onChange={(value) => setState((prev) => ({ ...prev, mood: value }))}
          />
          <EmojiScale
            label="How much energy do you have?"
            options={ENERGY_OPTIONS}
            value={state.energy}
            onChange={(value) => setState((prev) => ({ ...prev, energy: value }))}
          />
        </div>
      </FormSection>

      <Separator className="my-6" />

      <FormSection title="Reflect on your day">
        <div className="grid gap-5">
          {/* Show morning intention inline */}
          {morningContext?.intention ? (
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                This morning you said:
              </p>
              <p className="text-sm italic">&ldquo;{morningContext.intention}&rdquo;</p>
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="reflection" className="text-sm font-medium">
              {morningContext?.generatedPrompt ?? DEFAULT_EVENING_PROMPT}{' '}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reflection"
              placeholder="Capture what shifted, surprised, or felt meaningful"
              value={state.reflection}
              onChange={(event) => setState((prev) => ({ ...prev, reflection: event.target.value }))}
              rows={4}
              required
            />
          </div>
        </div>
      </FormSection>

      <Separator className="my-6" />

      <FormSection title="Celebrate your wins">
        <div className="grid gap-2">
          <Label htmlFor="wins" className="text-sm font-medium">
            What went well today? <span className="text-destructive">*</span>
          </Label>
          <p className="text-xs text-muted-foreground">Even small wins count — name at least one</p>
          <Textarea
            id="wins"
            placeholder="e.g., Had a productive conversation, finished a task I'd been avoiding"
            value={state.wins}
            onChange={(event) => setState((prev) => ({ ...prev, wins: event.target.value }))}
            rows={3}
            required
          />
        </div>
      </FormSection>

      <Separator className="my-6" />

      <FormSection title="Practice gratitude">
        <div className="grid gap-2">
          <Label htmlFor="gratitude" className="text-sm font-medium">
            What are you grateful for today? <span className="text-destructive">*</span>
          </Label>
          <p className="text-xs text-muted-foreground">Something that brought you ease, connection, or joy</p>
          <Textarea
            id="gratitude"
            placeholder="e.g., A kind word from a friend, the quiet of this evening"
            value={state.gratitude}
            onChange={(event) => setState((prev) => ({ ...prev, gratitude: event.target.value }))}
            rows={3}
            required
          />
        </div>
      </FormSection>

      <Separator className="my-6" />

      <FormSection title="Notice your parts">
        {!showParts ? (
          <button
            type="button"
            onClick={() => setShowParts(true)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
          >
            + Add parts that were active today
          </button>
        ) : (
          <PartsPicker
            label="Which parts were active today?"
            options={parts}
            selectedIds={state.parts}
            onToggle={(id) =>
              setState((prev) => ({
                ...prev,
                parts: prev.parts.includes(id) ? prev.parts.filter((value) => value !== id) : [...prev.parts, id],
              }))
            }
          />
        )}
      </FormSection>
    </>
  )
}

// Helper Components
interface FormSectionProps {
  title: string
  children: React.ReactNode
}

function FormSection({ title, children }: FormSectionProps) {
  return (
    <motion.section
      className="grid gap-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <h2 className="text-lg font-medium">{title}</h2>
      {children}
    </motion.section>
  )
}

// Utility functions
function isMorningDraftDirty(state: MorningState): boolean {
  return (
    state.mood !== MORNING_DEFAULTS.mood ||
    state.energy !== MORNING_DEFAULTS.energy ||
    state.mindForToday.trim().length > 0 ||
    state.intention.trim().length > 0 ||
    state.parts.length > 0
  )
}

function isEveningDraftDirty(state: EveningState, defaults: EveningState): boolean {
  return (
    state.mood !== defaults.mood ||
    state.energy !== defaults.energy ||
    state.reflection.trim().length > 0 ||
    state.wins.trim().length > 0 ||
    state.gratitude.trim().length > 0 ||
    state.parts.length > 0
  )
}
