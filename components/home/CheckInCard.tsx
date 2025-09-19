'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { GuardedLink } from '@/components/common/GuardedLink'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'

type TimeOfDay = 'morning' | 'evening' | 'none'
type TodayCheckInRow = { type: 'morning' | 'evening' }

interface CheckInCardProps {
  selectedDate?: Date
}

export function CheckInCard({ selectedDate = new Date() }: CheckInCardProps) {
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('none')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMorning, setHasMorning] = useState(false)
  const [hasEvening, setHasEvening] = useState(false)
  const isMountedRef = useRef(true)
  
  // Date calculations
  const targetDate = new Date(selectedDate)
  const targetDateString = targetDate.toISOString().slice(0, 10)
  const isViewingToday = targetDateString === new Date().toISOString().slice(0, 10)

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour >= 4 && hour < 12) {
      setTimeOfDay('morning')
    } else if (hour >= 18) {
      setTimeOfDay('evening')
    } else {
      setTimeOfDay('none')
    }
  }, [])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const fetchSelectedDateCheckIns = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const supabase = createClient()

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError

      if (user) {

        const { data, error } = await supabase
          .from('check_ins')
          .select('type')
          .eq('user_id', user.id)
          .eq('check_in_date', targetDateString)

        if (error) throw error

        if (!isMountedRef.current) return

        const entries = (data as TodayCheckInRow[] | null) ?? []
        setHasMorning(entries.some((entry) => entry.type === 'morning'))
        setHasEvening(entries.some((entry) => entry.type === 'evening'))
      } else {
        if (!isMountedRef.current) return
        setHasMorning(false)
        setHasEvening(false)
      }
    } catch (err) {
      console.error('Failed to load check-ins', err)
      if (!isMountedRef.current) return
      setError('We couldn’t load your check-ins. Please try again.')
    } finally {
      if (!isMountedRef.current) return
      setIsLoading(false)
    }
  }, [targetDateString])

  useEffect(() => {
    fetchSelectedDateCheckIns()
  }, [fetchSelectedDateCheckIns])

  // Only show time-based windows if we're looking at today
  const isMorningWindow = timeOfDay === 'morning' && isViewingToday
  const isEveningWindow = timeOfDay === 'evening' && isViewingToday

  if (isLoading) {
    return (
      <div className="col-span-2 rounded-xl border border-border bg-muted p-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-3 h-6 w-2/3" />
        <Skeleton className="mt-6 h-9 w-24" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="col-span-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        <div className="text-base font-semibold">Unable to load check-ins</div>
        <div className="mt-1 text-xs text-destructive/80">{error}</div>
        <Button
          variant="outline"
          className="mt-4 border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={fetchSelectedDateCheckIns}
          disabled={isLoading}
        >
          Try again
        </Button>
      </div>
    )
  }

  if (hasMorning && hasEvening) {
    return (
      <div className="col-span-2 rounded-xl border border-border bg-emerald-600 p-4 text-white">
        <div className="text-xs uppercase tracking-wide opacity-90">
          {isViewingToday ? 'Check-in complete' : 'Completed'}
        </div>
        <div className="text-lg font-semibold">
          {isViewingToday ? 'Great work today' : 'Full check-in'}
        </div>
        <p className="mt-2 text-sm text-emerald-100/90">
          {isViewingToday 
            ? "You've completed both your morning and evening reflections. See you tomorrow!"
            : "Both morning and evening check-ins were completed on this day."
          }
        </p>
      </div>
    )
  }

  if (hasMorning && !hasEvening) {
    if (isEveningWindow) {
      return (
        <div className="col-span-2 rounded-xl border border-border bg-indigo-600 p-4 text-white">
          <div className="text-xs opacity-90">Evening</div>
          <div className="text-lg font-semibold">Daily review</div>
          <p className="mt-2 text-sm text-indigo-100/90">Take a moment to wind down your day.</p>
          <GuardedLink href="/check-in/evening">
            <Button className="mt-4 bg-white text-black hover:bg-white/90">Begin</Button>
          </GuardedLink>
        </div>
      )
    }

    return (
      <div className="col-span-2 rounded-xl border border-border bg-muted p-4">
        <div className="text-base font-medium">Morning check-in complete</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Your evening reflection unlocks later today.
        </div>
      </div>
    )
  }

  if (!hasMorning && isMorningWindow) {
    return (
      <div className="col-span-2 rounded-xl border border-border bg-green-600 p-4 text-white">
        <div className="text-xs opacity-90">Morning</div>
        <div className="text-lg font-semibold">Fresh start!</div>
        <p className="mt-2 text-sm text-green-100/90">Set your intention and ease into the day.</p>
        <GuardedLink href="/check-in/morning">
          <Button className="mt-4 bg-white text-black hover:bg-white/90">Begin</Button>
        </GuardedLink>
      </div>
    )
  }

  if (isEveningWindow) {
    return (
      <div className="col-span-2 rounded-xl border border-border bg-indigo-600 p-4 text-white">
        <div className="text-xs opacity-90">Evening</div>
        <div className="text-lg font-semibold">Daily review</div>
        <p className="mt-2 text-sm text-indigo-100/90">Reflect on your day and notice what changed.</p>
        <GuardedLink href={hasMorning ? '/check-in/evening' : '/check-in/morning'}>
          <Button className="mt-4 bg-white text-black hover:bg-white/90">Begin</Button>
        </GuardedLink>
      </div>
    )
  }

  // Default case - no check-ins for this day
  if (!isViewingToday) {
    return (
      <div className="col-span-2 rounded-xl border border-border bg-muted p-4">
        <div className="text-base font-medium">No check-ins</div>
        <div className="mt-1 text-xs text-muted-foreground">
          No check-ins were completed on {targetDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short', 
            day: 'numeric'
          })}.
        </div>
      </div>
    )
  }

  return (
    <div className="col-span-2 rounded-xl border border-border bg-muted p-4">
      <div className="text-base font-medium">Come back later</div>
      <div className="mt-1 text-xs text-muted-foreground">
        Check-ins are available in the morning and evening.
      </div>
    </div>
  )
}
