'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ComponentPropsWithoutRef, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { CheckInTemplate } from './CheckInTemplate'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

const DEFAULT_EVENING_PROMPT = "What stood out for you today?"

type EmojiOption = {
  id: string
  emoji: string
  label: string
  score: number
}

const MOOD_OPTIONS: EmojiOption[] = [
  { id: 'depleted', emoji: '😔', label: 'Running on empty', score: 1 },
  { id: 'soft', emoji: '😕', label: 'Tender but okay', score: 2 },
  { id: 'steady', emoji: '🙂', label: 'Steady and present', score: 3 },
  { id: 'bright', emoji: '😄', label: 'Bright and open', score: 4 },
  { id: 'glowing', emoji: '🤩', label: 'Glowing with joy', score: 5 },
]

const ENERGY_OPTIONS: EmojiOption[] = [
  { id: 'drained', emoji: '😴', label: 'Running on fumes', score: 1 },
  { id: 'low', emoji: '😌', label: 'Soft but tired', score: 2 },
  { id: 'steady', emoji: '🙂', label: 'Steady and grounded', score: 3 },
  { id: 'spark', emoji: '⚡️', label: 'Spark of momentum', score: 4 },
  { id: 'soaring', emoji: '🚀', label: 'Soaring with energy', score: 5 },
]

const INTENTION_FOCUS_OPTIONS: EmojiOption[] = [
  { id: 'scattered', emoji: '😵‍💫', label: 'Still finding focus', score: 1 },
  { id: 'curious', emoji: '🤔', label: 'Curious and exploring', score: 2 },
  { id: 'aimed', emoji: '🎯', label: 'Clear on my aim', score: 3 },
  { id: 'committed', emoji: '💪', label: 'Committed to follow-through', score: 4 },
  { id: 'grounded', emoji: '🧘', label: 'Grounded and embodied', score: 5 },
]

const DEFAULT_MOOD_ID = MOOD_OPTIONS[2].id
const DEFAULT_ENERGY_ID = ENERGY_OPTIONS[2].id
const DEFAULT_INTENTION_FOCUS_ID = INTENTION_FOCUS_OPTIONS[2].id

type EmojiSelections = {
  mood: string
  energy: string
  intentionFocus: string
}

type MorningState = EmojiSelections & {
  mindForToday: string
  intention: string
  parts: string[]
}

type EveningState = EmojiSelections & {
  reflection: string
  gratitude: string
  moreNotes: string
  parts: string[]
}

type MorningContext = {
  id: string
  intention: string
  mindForToday: string
  parts: string[]
  emoji: EmojiSelections
  generatedPrompt: string
}

type PartOption = {
  id: string
  name: string
  emoji?: string | null
}

const createMorningState = (): MorningState => ({
  mood: DEFAULT_MOOD_ID,
  energy: DEFAULT_ENERGY_ID,
  intentionFocus: DEFAULT_INTENTION_FOCUS_ID,
  mindForToday: '',
  intention: '',
  parts: [],
})

const createEveningState = (defaults?: Partial<EveningState>): EveningState => ({
  mood: defaults?.mood ?? DEFAULT_MOOD_ID,
  energy: defaults?.energy ?? DEFAULT_ENERGY_ID,
  intentionFocus: defaults?.intentionFocus ?? DEFAULT_INTENTION_FOCUS_ID,
  reflection: defaults?.reflection ?? '',
  gratitude: defaults?.gratitude ?? '',
  moreNotes: defaults?.moreNotes ?? '',
  parts: defaults?.parts ?? [],
})

interface EmojiScaleInputProps {
  label: string
  options: EmojiOption[]
  value: string
  onChange: (value: string) => void
}

function EmojiScaleInput({ label, options, value, onChange }: EmojiScaleInputProps) {
  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      <div className="grid grid-cols-5 gap-2">
        {options.map((option) => {
          const selected = option.id === value
          return (
            <button
              type="button"
              key={option.id}
              onClick={() => onChange(option.id)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border bg-background px-3 py-2 text-2xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                selected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-foreground hover:border-primary/40 hover:bg-primary/5',
              )}
              aria-pressed={selected}
            >
              <span aria-hidden>{option.emoji}</span>
              <span className="text-xs text-muted-foreground">{option.label}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function getEmojiOption(options: EmojiOption[], id: string): EmojiOption {
  return options.find((option) => option.id === id) ?? options[0]
}

function toEmojiSummary(options: EmojiOption[], id: string) {
  const option = getEmojiOption(options, id)
  return { id: option.id, emoji: option.emoji, label: option.label, score: option.score }
}

interface DailyCheckInFormProps extends Omit<ComponentPropsWithoutRef<'div'>, 'onSubmit'> {
  variant: 'morning' | 'evening'
}

export function DailyCheckInForm({ variant, className, ...divProps }: DailyCheckInFormProps) {
  const router = useRouter()
  const [morningState, setMorningState] = useState<MorningState>(() => createMorningState())
  const [eveningState, setEveningState] = useState<EveningState>(() => createEveningState())
  const [morningContext, setMorningContext] = useState<MorningContext | null>(null)
  const [availableParts, setAvailableParts] = useState<PartOption[]>([])
  const [isFetchingContext, setIsFetchingContext] = useState(variant === 'evening')
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (variant === 'morning') {
      setMorningState(createMorningState())
      setMorningContext(null)
      setFetchError(null)
      setIsFetchingContext(false)
      setEveningState(createEveningState())
    } else {
      setEveningState(createEveningState())
      setIsFetchingContext(true)
    }
    setFormError(null)
  }, [variant])

  useEffect(() => {
    const fetchParts = async () => {
      const supabase = createClient()

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) throw userError
        if (!user) return

        const { data, error } = await supabase
          .from('parts')
          .select('id, name, visualization')
          .eq('user_id', user.id)
          .order('name', { ascending: true })

        if (error) throw error

        const parsed = (data ?? []).map((row) => {
          const visualization = (row.visualization as Record<string, unknown> | null) ?? null
          const emoji =
            visualization && typeof visualization === 'object' && typeof visualization.emoji === 'string'
              ? (visualization.emoji as string)
              : null
          return { id: row.id as string, name: row.name as string, emoji }
        })

        setAvailableParts(parsed)
      } catch (error) {
        console.error('Failed to load parts for check-in', error)
        setAvailableParts([])
      }
    }

    fetchParts()
  }, [])

  useEffect(() => {
    if (variant !== 'evening') return

    let active = true

    const fetchMorningData = async () => {
      setFetchError(null)
      const supabase = createClient()

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) throw userError
        if (!user) {
          throw new Error('User not found')
        }

        const today = new Date().toISOString().slice(0, 10)

        const { data, error } = await supabase
          .from('check_ins')
          .select('id, intention, parts_data, created_at')
          .eq('user_id', user.id)
          .eq('type', 'morning')
          .eq('check_in_date', today)
          .order('created_at', { ascending: false })
          .limit(1)

        if (error) throw error

        if (!data || data.length === 0) {
          if (!active) return
          setMorningContext(null)
          setFetchError('No morning check-in found for today.')
          return
        }

        const record = data[0]
        const partsData = (record.parts_data as Record<string, unknown> | null) ?? null
        const rawResponses =
          partsData && typeof partsData === 'object'
            ? (partsData as { daily_responses?: unknown }).daily_responses
            : undefined
        const storedResponses =
          rawResponses && typeof rawResponses === 'object'
            ? (rawResponses as Record<string, unknown> & { variant?: 'morning' | 'evening' })
            : undefined
        const responses =
          storedResponses && (!storedResponses.variant || storedResponses.variant === 'morning')
            ? storedResponses
            : undefined

        const emojiRecord =
          responses && typeof responses.emoji === 'object' && responses.emoji !== null
            ? (responses.emoji as Record<string, unknown>)
            : undefined

        const intention =
          typeof responses?.intention === 'string'
            ? responses.intention
            : typeof record.intention === 'string'
            ? record.intention
            : ''
        const mindForToday =
          typeof responses?.mindForToday === 'string' ? responses.mindForToday : ''
        const topLevelSelected = Array.isArray(
          (partsData as { selected_part_ids?: unknown })?.selected_part_ids,
        )
          ? (((partsData as { selected_part_ids?: unknown }).selected_part_ids as unknown[]) || []).filter(
              (id): id is string => typeof id === 'string',
            )
          : []
        const parts = Array.isArray(responses?.selectedPartIds)
          ? (responses?.selectedPartIds.filter((id) => typeof id === 'string') as string[])
          : topLevelSelected
        const generatedPrompt =
          responses && typeof responses.generatedEveningPrompt === 'object'
            ? ((responses.generatedEveningPrompt as { text?: unknown }).text as string | undefined)
            : undefined

        const moodSelection =
          emojiRecord && typeof (emojiRecord.mood as { id?: unknown } | undefined)?.id === 'string'
            ? ((emojiRecord.mood as { id: string }).id)
            : DEFAULT_MOOD_ID
        const energySelection =
          emojiRecord && typeof (emojiRecord.energy as { id?: unknown } | undefined)?.id === 'string'
            ? ((emojiRecord.energy as { id: string }).id)
            : DEFAULT_ENERGY_ID
        const intentionFocusSelection =
          emojiRecord &&
          typeof (emojiRecord.intentionFocus as { id?: unknown } | undefined)?.id === 'string'
            ? ((emojiRecord.intentionFocus as { id: string }).id)
            : DEFAULT_INTENTION_FOCUS_ID

        const emojiSelections: EmojiSelections = {
          mood: moodSelection,
          energy: energySelection,
          intentionFocus: intentionFocusSelection,
        }

        const context: MorningContext = {
          id: record.id as string,
          intention,
          mindForToday,
          parts,
          emoji: emojiSelections,
          generatedPrompt: generatedPrompt && generatedPrompt.length > 0 ? generatedPrompt : DEFAULT_EVENING_PROMPT,
        }

        if (active) {
          setMorningContext(context)
          setEveningState(
            createEveningState({
              mood: emojiSelections.mood,
              energy: emojiSelections.energy,
              intentionFocus: emojiSelections.intentionFocus,
              parts,
            }),
          )
          setFetchError(null)
        }
      } catch (error) {
        if (!active) return
        console.error('Failed to load morning check-in', error)
        setMorningContext(null)
        setFetchError('Could not load your morning check-in. Please try again later.')
      } finally {
        if (active) {
          setIsFetchingContext(false)
        }
      }
    }

    fetchMorningData()

    return () => {
      active = false
    }
  }, [variant])

  const handleMorningEmojiChange = (key: keyof EmojiSelections, value: string) => {
    setMorningState((prev) => ({ ...prev, [key]: value }))
  }

  const handleEveningEmojiChange = (key: keyof EmojiSelections, value: string) => {
    setEveningState((prev) => ({ ...prev, [key]: value }))
  }

  const toggleMorningPart = (partId: string) => {
    setMorningState((prev) => ({
      ...prev,
      parts: prev.parts.includes(partId)
        ? prev.parts.filter((id) => id !== partId)
        : [...prev.parts, partId],
    }))
  }

  const toggleEveningPart = (partId: string) => {
    setEveningState((prev) => ({
      ...prev,
      parts: prev.parts.includes(partId)
        ? prev.parts.filter((id) => id !== partId)
        : [...prev.parts, partId],
    }))
  }

  const partLookup = useMemo(() => {
    const map = new Map<string, PartOption>()
    for (const part of availableParts) {
      map.set(part.id, part)
    }
    return map
  }, [availableParts])

  const renderMorningSummary = () => {
    if (!morningContext) return null
    const mood = toEmojiSummary(MOOD_OPTIONS, morningContext.emoji.mood)
    const energy = toEmojiSummary(ENERGY_OPTIONS, morningContext.emoji.energy)
    const intentionFocus = toEmojiSummary(INTENTION_FOCUS_OPTIONS, morningContext.emoji.intentionFocus)
    return (
      <div className="grid gap-4 rounded-lg border border-border/60 bg-muted/40 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Morning snapshot</p>
          <div className="mt-2 flex gap-4 text-2xl">
            <span title={mood.label} aria-label={`Morning mood: ${mood.label}`}>
              {mood.emoji}
            </span>
            <span title={energy.label} aria-label={`Morning energy: ${energy.label}`}>
              {energy.emoji}
            </span>
            <span title={intentionFocus.label} aria-label={`Morning intention focus: ${intentionFocus.label}`}>
              {intentionFocus.emoji}
            </span>
          </div>
        </div>
        {morningContext.mindForToday && (
          <div className="grid gap-1 text-sm">
            <p className="text-muted-foreground">You shared this morning:</p>
            <blockquote className="border-l-2 pl-3 italic">“{morningContext.mindForToday}”</blockquote>
          </div>
        )}
        {morningContext.intention && (
          <div className="grid gap-1 text-sm">
            <p className="text-muted-foreground">Intention you set:</p>
            <blockquote className="border-l-2 pl-3 italic">“{morningContext.intention}”</blockquote>
          </div>
        )}
        {morningContext.parts.length > 0 && (
          <div className="grid gap-2 text-sm">
            <p className="text-muted-foreground">Parts you noticed:</p>
            <div className="flex flex-wrap gap-2">
              {morningContext.parts.map((partId) => {
                const part = partLookup.get(partId)
                return (
                  <span
                    key={partId}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-3 py-1 text-xs"
                  >
                    <span aria-hidden>{part?.emoji ?? '🧩'}</span>
                    <span>{part?.name ?? 'Part'}</span>
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return
    if (variant === 'evening' && (!morningContext || fetchError)) return

    setFormError(null)
    setIsSubmitting(true)

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
              gratitude: eveningState.gratitude.trim(),
              moreNotes: eveningState.moreNotes.trim(),
              parts: eveningState.parts,
            }

      const response = await fetch('/api/check-ins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        let message = 'Failed to submit check-in'
        try {
          const data = await response.json()
          if (typeof data?.error === 'string') {
            message = data.error
          }
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(message)
      }

      router.push('/')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      setFormError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitDisabled =
    variant === 'evening' && (!morningContext || !!fetchError || isFetchingContext)
  const error = fetchError ?? formError
  const hasParts = availableParts.length > 0

  if (variant === 'evening' && isFetchingContext) {
    return (
      <div className={cn('flex flex-col gap-6', className)} {...divProps}>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full mt-4" />
          </CardContent>
        </Card>
      </div>
    )
  }

  const partsSelector = (selectedIds: string[], onToggle: (id: string) => void) => (
    <div className="grid gap-2">
      <Label>Any parts feel active?</Label>
      {hasParts ? (
        <>
          <div className="flex flex-wrap gap-2">
            {availableParts.map((part) => {
              const selected = selectedIds.includes(part.id)
              return (
                <Button
                  key={part.id}
                  type="button"
                  variant={selected ? 'default' : 'outline'}
                  className={cn('h-auto rounded-full px-3 py-1 text-sm', selected && 'shadow-sm')}
                  onClick={() => onToggle(part.id)}
                >
                  <span className="mr-1" aria-hidden>
                    {part.emoji ?? '🧩'}
                  </span>
                  {part.name}
                </Button>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">New part?</span> Mention it below in
            “Anything else?” or start a chat to explore together.
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          You can capture new parts in the “Anything else?” note or during a chat.
        </p>
      )}
    </div>
  )

  return (
    <CheckInTemplate
      title={variant === 'morning' ? 'Morning Check-in' : 'Evening Review'}
      description={
        variant === 'morning' ? "What's on your mind this morning?" : "Let's reflect on your day."
      }
      isLoading={isSubmitting}
      submitText={variant === 'morning' ? 'Complete Check-in' : 'Complete Review'}
      submitDisabled={submitDisabled}
      error={error}
      className={className}
      onSubmit={handleSubmit}
      preFieldsContent={variant === 'evening' ? renderMorningSummary() : undefined}
      {...divProps}
    >
      <div className="grid gap-6">
        <div className="grid gap-4">
          <EmojiScaleInput
            label="How are you feeling right now?"
            options={MOOD_OPTIONS}
            value={variant === 'morning' ? morningState.mood : eveningState.mood}
            onChange={(value) =>
              variant === 'morning'
                ? handleMorningEmojiChange('mood', value)
                : handleEveningEmojiChange('mood', value)
            }
          />
          <EmojiScaleInput
            label="How much energy do you have?"
            options={ENERGY_OPTIONS}
            value={variant === 'morning' ? morningState.energy : eveningState.energy}
            onChange={(value) =>
              variant === 'morning'
                ? handleMorningEmojiChange('energy', value)
                : handleEveningEmojiChange('energy', value)
            }
          />
          <EmojiScaleInput
            label="How anchored do you feel in your intention?"
            options={INTENTION_FOCUS_OPTIONS}
            value={
              variant === 'morning'
                ? morningState.intentionFocus
                : eveningState.intentionFocus
            }
            onChange={(value) =>
              variant === 'morning'
                ? handleMorningEmojiChange('intentionFocus', value)
                : handleEveningEmojiChange('intentionFocus', value)
            }
          />
        </div>

        {variant === 'morning' ? (
          <div className="grid gap-4">
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
                required
                value={morningState.intention}
                onChange={(event) =>
                  setMorningState((prev) => ({ ...prev, intention: event.target.value }))
                }
              />
            </div>
            {partsSelector(morningState.parts, toggleMorningPart)}
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="reflection">
                {morningContext?.generatedPrompt ?? DEFAULT_EVENING_PROMPT}
              </Label>
              <Textarea
                id="reflection"
                placeholder="Capture what stood out, shifted, or surprised you."
                required
                value={eveningState.reflection}
                onChange={(event) =>
                  setEveningState((prev) => ({ ...prev, reflection: event.target.value }))
                }
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
            {partsSelector(eveningState.parts, toggleEveningPart)}
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
        )}
      </div>
    </CheckInTemplate>
  )
}
