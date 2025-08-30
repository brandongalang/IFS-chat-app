'use client'

import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function MorningCheckInForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [intention, setIntention] = useState('')
  const [worries, setWorries] = useState('')
  const [lookingForwardTo, setLookingForwardTo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      // TODO: Get the user ID from the session
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

      // Redirect to home page on successful submission
      router.push('/')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Morning Check-in</CardTitle>
          <CardDescription>What's on your mind this morning?</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="intention">What is your main intention for today?</Label>
                <Textarea
                  id="intention"
                  placeholder="e.g., To be present in my conversations."
                  required
                  value={intention}
                  onChange={(e) => setIntention(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="worries">What&apos;s one thing you&apos;re worried about?</Label>
                <Textarea
                  id="worries"
                  placeholder="e.g., My upcoming presentation."
                  value={worries}
                  onChange={(e) => setWorries(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lookingForwardTo">What are you looking forward to today?</Label>
                <Textarea
                  id="lookingForwardTo"
                  placeholder="e.g., A walk in the park."
                  value={lookingForwardTo}
                  onChange={(e) => setLookingForwardTo(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Complete Check-in'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
