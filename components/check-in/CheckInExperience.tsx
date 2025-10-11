'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
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
  additionalNotes: string
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
    additionalNotes: '',
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
  const successResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (variant === 'evening') {
      setEveningState((prev) => (isEveningDraftDirty(prev, eveningDefaults) ? prev : eveningDefaults))
    }
  }, [eveningDefaults, variant])

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
      if (!morningContext) {
        setFormError("We couldn't load your morning check-in. Try refreshing the page.")
        setActionStatus('idle')
        return
      }
      if (!eveningState.reflection.trim()) {
        setFormError('A brief reflection helps close the loop. Please add one before saving.')
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
              gratitude: eveningState.additionalNotes.trim(),
              moreNotes: eveningState.additionalNotes.trim(),
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
    variant === 'morning' ? morningState.intention.trim().length > 0 : eveningState.reflection.trim().length > 0

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
            partLookup={partLookup}
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
  return (
    <>
      <FormSection title="How are you arriving?">
        <div className="grid gap-5">
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
          <EmojiScale
            label="How anchored do you feel in your intention?"
            options={INTENTION_FOCUS_OPTIONS}
            value={state.intentionFocus}
            onChange={(value) => setState((prev) => ({ ...prev, intentionFocus: value }))}
          />
        </div>
      </FormSection>

      <Separator className="my-6" />

      <FormSection title="Set your intention">
        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="intention" className="text-sm font-medium">
              What&apos;s your intention for today? <span className="text-destructive">*</span>
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
  partLookup: Map<string, PartOption>
}

function EveningForm({ state, setState, parts, morningContext, partLookup }: EveningFormProps) {
  return (
    <>
      {morningContext ? (
        <>
          <MorningSummary context={morningContext} partLookup={partLookup} />
          <Separator className="my-6" />
        </>
      ) : null}

      <FormSection title="How are you landing tonight?">
        <div className="grid gap-5">
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
          <EmojiScale
            label="How anchored do you feel in your intention?"
            options={INTENTION_FOCUS_OPTIONS}
            value={state.intentionFocus}
            onChange={(value) => setState((prev) => ({ ...prev, intentionFocus: value }))}
          />
        </div>
      </FormSection>

      <Separator className="my-6" />

      <FormSection title="Reflect on your day">
        <div className="grid gap-5">
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
          <div className="grid gap-2">
            <Label htmlFor="additionalNotes" className="text-sm font-medium text-muted-foreground">
              Additional notes (optional)
            </Label>
            <p className="text-xs text-muted-foreground">Gratitude, wins, or messages to future you</p>
            <Textarea
              id="additionalNotes"
              placeholder="Anything else you want to remember about today"
              value={state.additionalNotes}
              onChange={(event) => setState((prev) => ({ ...prev, additionalNotes: event.target.value }))}
              rows={3}
            />
          </div>
        </div>
      </FormSection>

      <Separator className="my-6" />

      <FormSection title="Notice your parts">
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
    state.additionalNotes.trim().length > 0 ||
    state.parts.length > 0
  )
}
