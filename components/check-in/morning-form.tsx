'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CheckInTemplate, FormField } from './CheckInTemplate'

export function MorningCheckInForm({ className, ...props }: Omit<React.ComponentPropsWithoutRef<'div'>, 'onSubmit'>) {
  const [intention, setIntention] = useState('')
  const [worries, setWorries] = useState('')
  const [lookingForwardTo, setLookingForwardTo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const trimmedIntention = intention.trim()

      if (!trimmedIntention) {
        setError('Intention is required')
        setIsSubmitting(false)
        return
      }

      const partsData: Record<string, string> = {}
      if (worries.trim()) {
        partsData.morning_worries = worries.trim()
      }
      if (lookingForwardTo.trim()) {
        partsData.morning_looking_forward_to = lookingForwardTo.trim()
      }

      const payload: Record<string, unknown> = {
        type: 'morning',
        intention: trimmedIntention,
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
      isLoading={isSubmitting}
      submitText="Complete Check-in"
      error={error}
      className={className}
      {...props}
      onSubmit={handleSubmit}
    />
  )
}
