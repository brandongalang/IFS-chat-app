'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { GuardedLink } from '@/components/common/GuardedLink'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'

type TimeOfDay = 'morning' | 'evening' | 'none'
type TodayCheckInRow = { type: 'morning' | 'evening' }

export function CheckInCard() {
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('none')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMorning, setHasMorning] = useState(false)
  const [hasEvening, setHasEvening] = useState(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour >= 4 && hour < 12) {
      setTimeOfDay('morning')
    } else if (hour >= 16 && hour < 22) {
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

  const fetchTodayCheckIns = useCallback(async () => {
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
        const today = new Date()
        const todayString = today.toISOString().slice(0, 10)

        const { data, error } = await supabase
          .from('check_ins')
          .select('type')
          .eq('user_id', user.id)
          .eq('check_in_date', todayString)

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
  }, [])

  useEffect(() => {
    fetchTodayCheckIns()
  }, [fetchTodayCheckIns])

  const isMorningWindow = timeOfDay === 'morning'
  const isEveningWindow = timeOfDay === 'evening'

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
          onClick={fetchTodayCheckIns}
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
        <div className="text-xs uppercase tracking-wide opacity-90">Check-in complete</div>
        <div className="text-lg font-semibold">Great work today</div>
        <p className="mt-2 text-sm text-emerald-100/90">
          You’ve completed both your morning and evening reflections. See you tomorrow!
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
          <GuardedLink href="/check-in">
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
        <GuardedLink href="/check-in">
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
        <GuardedLink href="/check-in">
          <Button className="mt-4 bg-white text-black hover:bg-white/90">Begin</Button>
        </GuardedLink>
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
