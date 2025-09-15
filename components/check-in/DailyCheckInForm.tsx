'use client'

import { useEffect, useState } from 'react'
import type { ChangeEvent, ComponentPropsWithoutRef, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { CheckInTemplate, type FormField } from './CheckInTemplate'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface DailyCheckInFormProps extends Omit<ComponentPropsWithoutRef<'div'>, 'onSubmit'> {
  variant: 'morning' | 'evening'
}

type MorningState = {
  intention: string
  worries: string
  lookingForwardTo: string
}

type EveningState = {
  reflectionOnIntention: string
  reflectionOnWorries: string
  reflectionOnLookingForwardTo: string
  gratitude: string
}

type MorningContext = {
  intention: string
  worries: string
  lookingForwardTo: string
}

const createMorningState = (): MorningState => ({
  intention: '',
  worries: '',
  lookingForwardTo: '',
})

const createEveningState = (): EveningState => ({
  reflectionOnIntention: '',
  reflectionOnWorries: '',
  reflectionOnLookingForwardTo: '',
  gratitude: '',
})

export function DailyCheckInForm({ variant, className, ...divProps }: DailyCheckInFormProps) {
  const router = useRouter()
  const [morningState, setMorningState] = useState<MorningState>(() => createMorningState())
  const [eveningState, setEveningState] = useState<EveningState>(() => createEveningState())
  const [morningContext, setMorningContext] = useState<MorningContext | null>(null)
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
    } else {
      setEveningState(createEveningState())
      setIsFetchingContext(true)
    }
    setFormError(null)
  }, [variant])

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

        const { data, error } = await supabase
          .from('check_ins')
          .select('id, intention, parts_data, created_at')
          .eq('user_id', user.id)
          .eq('type', 'morning')
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
        const morningResponses =
          storedResponses && (!storedResponses.variant || storedResponses.variant === 'morning')
            ? storedResponses
            : undefined

        const intention =
          typeof morningResponses?.intention === 'string'
            ? morningResponses.intention
            : typeof record.intention === 'string'
            ? record.intention
            : ''
        const worries = typeof morningResponses?.worries === 'string' ? morningResponses.worries : ''
        const lookingForwardTo =
          typeof morningResponses?.lookingForwardTo === 'string'
            ? morningResponses.lookingForwardTo
            : ''

        if (active) {
          setMorningContext({
            intention,
            worries,
            lookingForwardTo,
          })
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

  const handleMorningChange = (key: keyof MorningState) => (event: ChangeEvent<HTMLTextAreaElement>) => {
    setMorningState((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const handleEveningChange = (key: keyof EveningState) => (event: ChangeEvent<HTMLTextAreaElement>) => {
    setEveningState((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const fields: FormField[] =
    variant === 'morning'
      ? [
          {
            id: 'intention',
            label: 'What is your main intention for today?',
            placeholder: 'e.g., To be present in my conversations.',
            required: true,
            value: morningState.intention,
            onChange: handleMorningChange('intention'),
          },
          {
            id: 'worries',
            label: "What's one thing you're worried about?",
            placeholder: 'e.g., My upcoming presentation.',
            value: morningState.worries,
            onChange: handleMorningChange('worries'),
          },
          {
            id: 'lookingForwardTo',
            label: 'What are you looking forward to today?',
            placeholder: 'e.g., A walk in the park.',
            value: morningState.lookingForwardTo,
            onChange: handleMorningChange('lookingForwardTo'),
          },
        ]
      : [
          {
            id: 'gratitude',
            label: "What's one thing you're grateful for today?",
            placeholder: 'e.g., A quiet cup of tea.',
            value: eveningState.gratitude,
            onChange: handleEveningChange('gratitude'),
          },
        ]

  const preFieldsContent =
    variant === 'evening' ? (
      <>
        {morningContext?.intention && (
          <div className="grid gap-2 text-sm">
            <p className="text-muted-foreground">This morning, your intention was:</p>
            <blockquote className="border-l-2 pl-3 italic">&quot;{morningContext.intention}&quot;</blockquote>
            <Label htmlFor="reflectionOnIntention" className="mt-2">
              How did that go?
            </Label>
            <Textarea
              id="reflectionOnIntention"
              placeholder="e.g., I made some progress, but it was a struggle at times."
              required
              value={eveningState.reflectionOnIntention}
              onChange={handleEveningChange('reflectionOnIntention')}
            />
          </div>
        )}
        {morningContext?.worries && (
          <div className="grid gap-2 text-sm">
            <p className="text-muted-foreground">You were worried about:</p>
            <blockquote className="border-l-2 pl-3 italic">&quot;{morningContext.worries}&quot;</blockquote>
            <Label htmlFor="reflectionOnWorries" className="mt-2">
              How are you feeling about that now?
            </Label>
            <Textarea
              id="reflectionOnWorries"
              placeholder="e.g., It wasn't as bad as I thought."
              value={eveningState.reflectionOnWorries}
              onChange={handleEveningChange('reflectionOnWorries')}
            />
          </div>
        )}
        {morningContext?.lookingForwardTo && (
          <div className="grid gap-2 text-sm">
            <p className="text-muted-foreground">You were looking forward to:</p>
            <blockquote className="border-l-2 pl-3 italic">&quot;{morningContext.lookingForwardTo}&quot;</blockquote>
            <Label htmlFor="reflectionOnLookingForwardTo" className="mt-2">
              How was it?
            </Label>
            <Textarea
              id="reflectionOnLookingForwardTo"
              placeholder="e.g., It was wonderful!"
              value={eveningState.reflectionOnLookingForwardTo}
              onChange={handleEveningChange('reflectionOnLookingForwardTo')}
            />
          </div>
        )}
      </>
    ) : undefined

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
              responses: {
                intention: morningState.intention.trim(),
                worries: morningState.worries.trim(),
                lookingForwardTo: morningState.lookingForwardTo.trim(),
              },
            }
          : {
              type: 'evening' as const,
              gratitude: eveningState.gratitude.trim(),
              responses: {
                reflectionOnIntention: eveningState.reflectionOnIntention.trim(),
                reflectionOnWorries: eveningState.reflectionOnWorries.trim(),
                reflectionOnLookingForwardTo: eveningState.reflectionOnLookingForwardTo.trim(),
              },
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

  const submitDisabled = variant === 'evening' && (!morningContext || !!fetchError)
  const error = fetchError ?? formError

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
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full mt-4" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <CheckInTemplate
      title={variant === 'morning' ? 'Morning Check-in' : 'Evening Review'}
      description={
        variant === 'morning' ? "What's on your mind this morning?" : "Let's reflect on your day."
      }
      fields={fields}
      preFieldsContent={preFieldsContent}
      isLoading={isSubmitting}
      submitText={variant === 'morning' ? 'Complete Check-in' : 'Complete Review'}
      submitDisabled={submitDisabled}
      error={error}
      className={className}
      onSubmit={handleSubmit}
      {...divProps}
    />
  )
}
