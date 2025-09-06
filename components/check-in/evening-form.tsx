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
  const [isLoading, setIsLoading] = useState(true)
  const [checkInId, setCheckInId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchMorningData = async () => {
      setIsLoading(true)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: checkIns, error } = await supabase
          .from('check_ins')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'morning_completed')
          .order('created_at', { ascending: false })
          .limit(1)

        if (error) {
          setError('Could not load your morning check-in. Please try again later.')
        } else if (checkIns && checkIns.length > 0) {
          const morningCheckIn = checkIns[0]
          setCheckInId(morningCheckIn.id)
          setMorningIntention(morningCheckIn.morning_intention || '')
          setMorningWorries(morningCheckIn.morning_worries || '')
          setMorningLookingForwardTo(morningCheckIn.morning_looking_forward_to || '')
        } else {
          setError('No morning check-in found for today.')
        }
      }
      setIsLoading(false)
    }

    fetchMorningData()
  }, [])

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    if (!checkInId) return

    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase
        .from('check_ins')
        .update({
          evening_reflection_on_intention: reflectionOnIntention,
          evening_reflection_on_worries: reflectionOnWorries,
          evening_reflection_on_looking_forward_to: reflectionOnLookingForwardTo,
          evening_gratitude: gratitude,
          status: 'evening_completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', checkInId)

      if (error) throw error

      router.push('/')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
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

  if (isLoading) {
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
      isLoading={isLoading}
      submitText="Complete Review"
      submitDisabled={!checkInId}
      error={error}
      className={className}
      {...props}
      onSubmit={handleSubmit}
    />
  )
}
