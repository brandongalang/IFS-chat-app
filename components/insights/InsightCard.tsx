'use client'

import * as React from 'react'
import { InsightRow } from '@/lib/types/database'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RatingControl } from './RatingControl'
import { Loader2 } from 'lucide-react'

const ratingValueToLabelMap: { [key: number]: string } = {
  1: 'strongly_disagree',
  2: 'somewhat_disagree',
  3: 'somewhat_agree',
  4: 'strongly_agree',
}

interface InsightCardProps {
  insight: InsightRow
  onActioned: (id: string) => void
}

type DisplayStatus = 'pending' | 'revealing' | 'revealed' | 'submitting'

export function InsightCard({ insight, onActioned }: InsightCardProps) {
  // The card's internal state determines what UI to show.
  // It's initialized from the prop but can change based on user actions.
  const [displayStatus, setDisplayStatus] = React.useState<DisplayStatus>(
    insight.status === 'revealed' ? 'revealed' : 'pending'
  )
  const [rating, setRating] = React.useState<number | undefined>()
  const [feedback, setFeedback] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const handleReveal = async () => {
    setDisplayStatus('revealing')
    setError(null)
    try {
      const res = await fetch(`/api/insights/${insight.id}/reveal`, { method: 'POST' })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to reveal insight. Please try again.')
      }
      setDisplayStatus('revealed')
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message)
      } else {
        setError('An unexpected error occurred.')
      }
      setDisplayStatus('pending') // Revert to pending on error
    }
  }

  const handleSubmit = async () => {
    if (!rating) {
      setError('A rating is required to submit feedback.')
      return
    }

    setDisplayStatus('submitting')
    setError(null)

    const payload = {
      rating: {
        scheme: 'quartile-v1',
        value: rating,
        label: ratingValueToLabelMap[rating],
      },
      // Only include feedback if it's not an empty string.
      ...(feedback && { feedback }),
    }

    try {
      const res = await fetch(`/api/insights/${insight.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to submit feedback. Please try again.')
      }
      // On success, call the parent callback to remove the card from the list.
      onActioned(insight.id)
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message)
      } else {
        setError('An unexpected error occurred.')
      }
      setDisplayStatus('revealed') // Revert to revealed on error
    }
  }

  if (displayStatus === 'pending' || displayStatus === 'revealing') {
    return (
      <Card className="h-full flex flex-col justify-between text-center">
        <CardHeader>
          <CardTitle>{insight.content.title || 'A new insight is ready'}</CardTitle>
          <CardDescription>Your weekly reflection is available.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Placeholder content for pending state can go here */}
        </CardContent>
        <CardFooter>
          <Button onClick={handleReveal} disabled={displayStatus === 'revealing'} className="w-full">
            {displayStatus === 'revealing' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reveal Insight
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>{insight.content.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        <p className="text-sm text-muted-foreground mb-6">{insight.content.body}</p>
        <div className="mt-auto">
          <div>
            <h4 className="text-md font-semibold">How accurate is this observation?</h4>
            <RatingControl value={rating} onChange={setRating} />
          </div>
          <div className="mt-4">
            <Label htmlFor={`feedback-${insight.id}`}>Add optional feedback (private)</Label>
            <Textarea
              id={`feedback-${insight.id}`}
              placeholder="What else is on your mind?"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="mt-2"
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-stretch">
        {error && <p className="text-sm text-destructive mb-2 text-center">{error}</p>}
        <Button onClick={handleSubmit} disabled={!rating || displayStatus === 'submitting'} className="w-full">
          {displayStatus === 'submitting' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Feedback
        </Button>
      </CardFooter>
    </Card>
  )
}
