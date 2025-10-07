'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MORNING_START_HOUR as SHARED_MORNING_START_HOUR,
  EVENING_START_HOUR as SHARED_EVENING_START_HOUR,
  type CheckInOverviewPayload,
  type CheckInOverviewSlot,
} from '@/lib/check-ins/shared'

type CheckInType = 'morning' | 'evening'

export interface CheckInSlotState extends CheckInOverviewSlot {
  type: CheckInType
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
  streak: number
}

export const MORNING_START_HOUR = SHARED_MORNING_START_HOUR
export const EVENING_START_HOUR = SHARED_EVENING_START_HOUR

const EMPTY_SLOT: CheckInOverviewSlot = {
  status: 'not_recorded',
  completed: false,
  completedAt: null,
  availableAt: null,
}

function toSlotState(type: CheckInType, slot: CheckInOverviewSlot | null | undefined): CheckInSlotState {
  const base = slot ?? EMPTY_SLOT
  return {
    ...base,
    type,
    canStart: base.status === 'available',
  }
}

export function useDailyCheckIns(selectedDate: Date = new Date()): UseDailyCheckInsResult {
  const isMountedRef = useRef(true)
  const requestRef = useRef<AbortController | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<CheckInOverviewPayload | null>(null)

  const targetDate = useMemo(() => new Date(selectedDate), [selectedDate])
  const targetDateString = targetDate.toISOString().slice(0, 10)
  const todayString = new Date().toISOString().slice(0, 10)
  const isViewingToday = targetDateString === todayString

  const fetchOverview = useCallback(async () => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/check-ins/overview?date=${targetDateString}`, {
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Failed to load check-ins: ${response.status}`)
      }

      const payload = (await response.json()) as CheckInOverviewPayload

      if (!isMountedRef.current || controller.signal.aborted) return
      setOverview(payload)
    } catch (err) {
      if ((err as Error | undefined)?.name === 'AbortError') {
        return
      }
      console.error('Failed to load check-in overview', err)
      if (!isMountedRef.current || controller.signal.aborted) return
      setError('We couldn’t load your check-ins. Please try again.')
      setOverview(null)
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null
      }
      if (isMountedRef.current && !controller.signal.aborted) {
        setIsLoading(false)
      }
    }
  }, [targetDateString])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      requestRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    fetchOverview()
    return () => {
      requestRef.current?.abort()
    }
  }, [fetchOverview])

  const morning = toSlotState('morning', overview?.morning)
  const evening = toSlotState('evening', overview?.evening)

  const refetch = useCallback(async () => {
    await fetchOverview()
  }, [fetchOverview])

  return {
    isLoading,
    error,
    refetch,
    isViewingToday,
    targetDate,
    morning,
    evening,
    streak: overview?.streak ?? 0,
  }
}
