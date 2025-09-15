'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { CheckInTemplate, FormField } from './CheckInTemplate'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function EveningCheckInForm({ className, ...props }: Omit<React.ComponentPropsWithoutRef<'div'>, 'onSubmit'>) {
  const [morningIntention, setMorningIntention] = useState('')
  const [morningWorries, setMorningWorries] = useState('')
  const [morningLookingForwardTo, setMorningLookingForwardTo] = useState('')
  const [reflectionOnIntention, setReflectionOnIntention] = useState('')
  const [reflectionOnWorries, setReflectionOnWorries] = useState('')
  const [reflectionOnLookingForwardTo, setReflectionOnLookingForwardTo] = useState('')
  const [gratitude, setGratitude] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isFetchingMorning, setIsFetchingMorning] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasMorningCheckIn, setHasMorningCheckIn] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const fetchMorningData = async () => {
      setIsFetchingMorning(true)
      setError(null)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const today = new Date().toISOString().slice(0, 10)
        const { data: checkIns, error } = await supabase
          .from('check_ins')
          .select('intention, parts_data, check_in_date')
          .eq('user_id', user.id)
          .eq('type', 'morning')
          .eq('check_in_date', today)
          .order('created_at', { ascending: false })
          .limit(1)

        if (error) {
          setError('Could not load your morning check-in. Please try again later.')
        } else if (checkIns && checkIns.length > 0) {
          const morningCheckIn = checkIns[0]
          setHasMorningCheckIn(true)
          setMorningIntention(morningCheckIn.intention || '')

          const partsData = (morningCheckIn.parts_data || {}) as Record<string, unknown>
          setMorningWorries(
            typeof partsData.morning_worries === 'string' ? partsData.morning_worries : ''
          )
          setMorningLookingForwardTo(
            typeof partsData.morning_looking_forward_to === 'string'
              ? partsData.morning_looking_forward_to
              : ''
          )
        } else {
          setError('No morning check-in found for today.')
          setHasMorningCheckIn(false)
        }
      } else {
        setError('You need to be signed in to view your check-ins.')
        setHasMorningCheckIn(false)
      }
      setIsFetchingMorning(false)
    }

    fetchMorningData()
  }, [])

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    if (!hasMorningCheckIn) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const trimmedReflectionOnIntention = reflectionOnIntention.trim()
      const trimmedReflectionOnWorries = reflectionOnWorries.trim()
      const trimmedReflectionOnLookingForwardTo = reflectionOnLookingForwardTo.trim()
      const trimmedGratitude = gratitude.trim()

      const combinedReflection = [
        trimmedReflectionOnIntention && `Intention: ${trimmedReflectionOnIntention}`,
        trimmedReflectionOnWorries && `Worries: ${trimmedReflectionOnWorries}`,
        trimmedReflectionOnLookingForwardTo &&
          `Looking forward: ${trimmedReflectionOnLookingForwardTo}`,
      ]
        .filter(Boolean)
        .join('\n\n')

      const partsData: Record<string, string> = {}

      if (morningIntention.trim()) {
        partsData.morning_intention = morningIntention.trim()
      }
      if (morningWorries.trim()) {
        partsData.morning_worries = morningWorries.trim()
      }
      if (morningLookingForwardTo.trim()) {
        partsData.morning_looking_forward_to = morningLookingForwardTo.trim()
      }
      if (trimmedReflectionOnIntention) {
        partsData.reflection_on_intention = trimmedReflectionOnIntention
      }
      if (trimmedReflectionOnWorries) {
        partsData.reflection_on_worries = trimmedReflectionOnWorries
      }
      if (trimmedReflectionOnLookingForwardTo) {
        partsData.reflection_on_looking_forward_to = trimmedReflectionOnLookingForwardTo
      }

      const payload: Record<string, unknown> = {
        type: 'evening',
      }

      if (combinedReflection) {
        payload.reflection = combinedReflection
      }

      if (trimmedGratitude) {
        payload.gratitude = trimmedGratitude
      }

      if (Object.keys(partsData).length > 0) {
        payload.parts_data = partsData
      }

      const response = await fetch('/api/check-ins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        let message = 'Failed to save your check-in'
        try {
          const data = await response.json()
          if (data?.error) {
            message = data.error
          }
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(message)
      }

      router.push('/')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const fields: FormField[] = [
    {
      id: 'gratitude',
      label: "What's one thing you're grateful for today?",
      placeholder: 'e.g., A quiet cup of tea.',
      value: gratitude,
      onChange: (e) => setGratitude(e.target.value),
    },
  ]

  const preFieldsContent = (
    <>
      {morningIntention && (
        <div className="grid gap-2 text-sm">
          <p className="text-muted-foreground">This morning, your intention was:</p>
          <blockquote className="border-l-2 pl-3 italic">&quot;{morningIntention}&quot;</blockquote>
          <Label htmlFor="reflectionOnIntention" className="mt-2">
            How did that go?
          </Label>
          <Textarea
            id="reflectionOnIntention"
            placeholder="e.g., I made some progress, but it was a struggle at times."
            required
            value={reflectionOnIntention}
            onChange={(e) => setReflectionOnIntention(e.target.value)}
          />
        </div>
      )}
      {morningWorries && (
        <div className="grid gap-2 text-sm">
          <p className="text-muted-foreground">You were worried about:</p>
          <blockquote className="border-l-2 pl-3 italic">&quot;{morningWorries}&quot;</blockquote>
          <Label htmlFor="reflectionOnWorries" className="mt-2">
            How are you feeling about that now?
          </Label>
          <Textarea
            id="reflectionOnWorries"
            placeholder="e.g., It wasn't as bad as I thought."
            value={reflectionOnWorries}
            onChange={(e) => setReflectionOnWorries(e.target.value)}
          />
        </div>
      )}
      {morningLookingForwardTo && (
        <div className="grid gap-2 text-sm">
          <p className="text-muted-foreground">You were looking forward to:</p>
          <blockquote className="border-l-2 pl-3 italic">&quot;{morningLookingForwardTo}&quot;</blockquote>
          <Label htmlFor="reflectionOnLookingForwardTo" className="mt-2">
            How was it?
          </Label>
          <Textarea
            id="reflectionOnLookingForwardTo"
            placeholder="e.g., It was wonderful!"
            value={reflectionOnLookingForwardTo}
            onChange={(e) => setReflectionOnLookingForwardTo(e.target.value)}
          />
        </div>
      )}
    </>
  )

  if (isFetchingMorning) {
    return (
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
    )
  }

  return (
    <CheckInTemplate
      title="Evening Review"
      description="Let's reflect on your day."
      fields={fields}
      preFieldsContent={preFieldsContent}
      isLoading={isSubmitting}
      submitText="Complete Review"
      submitDisabled={!hasMorningCheckIn}
      error={error}
      className={className}
      {...props}
      onSubmit={handleSubmit}
    />
  )
}
