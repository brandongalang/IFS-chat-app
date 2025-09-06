'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CheckInTemplate, FormField } from './CheckInTemplate'

export function MorningCheckInForm({ className, ...props }: Omit<React.ComponentPropsWithoutRef<'div'>, 'onSubmit'>) {
  const [intention, setIntention] = useState('')
  const [worries, setWorries] = useState('')
  const [lookingForwardTo, setLookingForwardTo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('User not found')
      }

      const { error } = await supabase.from('check_ins').insert({
        user_id: user.id,
        morning_intention: intention,
        morning_worries: worries,
        morning_looking_forward_to: lookingForwardTo,
        status: 'morning_completed',
        completed_at: new Date().toISOString(),
      })

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
      id: 'intention',
      label: 'What is your main intention for today?',
      placeholder: 'e.g., To be present in my conversations.',
      required: true,
      value: intention,
      onChange: (e) => setIntention(e.target.value),
    },
    {
      id: 'worries',
      label: "What's one thing you're worried about?",
      placeholder: 'e.g., My upcoming presentation.',
      value: worries,
      onChange: (e) => setWorries(e.target.value),
    },
    {
      id: 'lookingForwardTo',
      label: 'What are you looking forward to today?',
      placeholder: 'e.g., A walk in the park.',
      value: lookingForwardTo,
      onChange: (e) => setLookingForwardTo(e.target.value),
    },
  ]

  return (
    <CheckInTemplate
      title="Morning Check-in"
      description="What's on your mind this morning?"
      fields={fields}
      isLoading={isLoading}
      submitText="Complete Check-in"
      error={error}
      className={className}
      {...props}
      onSubmit={handleSubmit}
    />
  )
}
