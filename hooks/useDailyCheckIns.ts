'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type CheckInType = 'morning' | 'evening'

interface TodayCheckInRow {
  type: CheckInType
}

type MorningStatus = 'completed' | 'available' | 'closed' | 'upcoming' | 'not_recorded'
type EveningStatus = 'completed' | 'available' | 'locked' | 'not_recorded'

export interface CheckInSlotState {
  type: CheckInType
  status: MorningStatus | EveningStatus
  completed: boolean
  canStart: boolean
}

export interface UseDailyCheckInsResult {
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  isViewingToday: boolean
  targetDate: Date
  morning: CheckInSlotState
  evening: CheckInSlotState
}

export const MORNING_START_HOUR = 4
export const EVENING_START_HOUR = 18

function computeStatuses(
  args: {
    hasMorning: boolean
    hasEvening: boolean
    isViewingToday: boolean
    now: Date
  }
) {
  const { hasMorning, hasEvening, isViewingToday, now } = args
  const hour = now.getHours()

  const morningStatus: MorningStatus = (() => {
    if (hasMorning) return 'completed'
    if (!isViewingToday) return 'not_recorded'
    if (hour < MORNING_START_HOUR) return 'upcoming'
    if (hour >= EVENING_START_HOUR) return 'closed'
    return 'available'
  })()

  const eveningStatus: EveningStatus = (() => {
    if (hasEvening) return 'completed'
    if (!isViewingToday) return 'not_recorded'
    if (hour < EVENING_START_HOUR) return 'locked'
    return 'available'
  })()

  return { morningStatus, eveningStatus }
}

export function useDailyCheckIns(selectedDate: Date = new Date()): UseDailyCheckInsResult {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMorning, setHasMorning] = useState(false)
  const [hasEvening, setHasEvening] = useState(false)
  const isMountedRef = useRef(true)

  const targetDate = useMemo(() => new Date(selectedDate), [selectedDate])
  const targetDateString = targetDate.toISOString().slice(0, 10)
  const todayString = new Date().toISOString().slice(0, 10)
  const isViewingToday = targetDateString === todayString

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

      if (!user) {
        if (!isMountedRef.current) return
        setHasMorning(false)
        setHasEvening(false)
        return
      }

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
    } catch (err) {
      console.error('Failed to load check-ins', err)
      if (!isMountedRef.current) return
      setError('We couldn’t load your check-ins. Please try again.')
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [targetDateString])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    fetchSelectedDateCheckIns()
  }, [fetchSelectedDateCheckIns])

  const now = new Date()
  const { morningStatus, eveningStatus } = computeStatuses({
    hasMorning,
    hasEvening,
    isViewingToday,
    now,
  })

  const morning: CheckInSlotState = {
    type: 'morning',
    status: morningStatus,
    completed: hasMorning,
    canStart: morningStatus === 'available',
  }

  const evening: CheckInSlotState = {
    type: 'evening',
    status: eveningStatus,
    completed: hasEvening,
    canStart: eveningStatus === 'available',
  }

  const refetch = useCallback(async () => {
    await fetchSelectedDateCheckIns()
  }, [fetchSelectedDateCheckIns])

  return {
    isLoading,
    error,
    refetch,
    isViewingToday,
    targetDate,
    morning,
    evening,
  }
}
