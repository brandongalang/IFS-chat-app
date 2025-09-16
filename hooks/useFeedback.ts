'use client'

import { useCallback } from 'react'
import { useToast } from './use-toast'

export type SubmitFeedbackArgs = {
  sessionId: string
  messageId: string
  rating: 'thumb_up' | 'thumb_down'
  explanation?: string
}

export function useFeedback() {
  const { toast } = useToast()

  const submitFeedback = useCallback(
    async ({ sessionId, messageId, rating, explanation }: SubmitFeedbackArgs) => {
      try {
        const res = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, messageId, rating, explanation }),
        })

        if (!res.ok) {
          throw new Error('Failed to submit feedback')
        }

        toast({ title: 'Feedback submitted', description: 'Thank you for your feedback!' })
        return true
      } catch (error) {
        console.error('Error submitting feedback:', error)
        toast({
          title: 'Error',
          description: 'Could not submit feedback. Please try again later.',
          variant: 'destructive',
        })
        return false
      }
    },
    [toast],
  )

  return { submitFeedback }
}
