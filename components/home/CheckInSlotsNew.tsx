'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  type CheckInSlotState,
  useDailyCheckIns,
} from '@/hooks/useDailyCheckIns'
import { GuardedLink } from '@/components/common/GuardedLink'
import { cn } from '@/lib/utils'
import { CHECK_IN_DRAFT_PREFIX } from '@/lib/check-ins/shared'

interface DraftState {
  morning: boolean
  evening: boolean
}

interface CheckInSlotsNewProps {
  selectedDate?: Date
}

export function CheckInSlotsNew({ selectedDate = new Date() }: CheckInSlotsNewProps) {
  const { isLoading, error, isViewingToday, targetDate, morning, evening } =
    useDailyCheckIns(selectedDate)

  const targetDateIso = useMemo(() => targetDate.toISOString().slice(0, 10), [targetDate])
  const [drafts, setDrafts] = useState<DraftState>({ morning: false, evening: false })

  const updateDrafts = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      const morningKey = `${CHECK_IN_DRAFT_PREFIX}-morning-${targetDateIso}`
      const eveningKey = `${CHECK_IN_DRAFT_PREFIX}-evening-${targetDateIso}`
      setDrafts({
        morning: window.localStorage.getItem(morningKey) !== null,
        evening: window.localStorage.getItem(eveningKey) !== null,
      })
    } catch (storageError) {
      console.warn('Unable to read check-in drafts', storageError)
      setDrafts({ morning: false, evening: false })
    }
  }, [targetDateIso])

  useEffect(() => {
    updateDrafts()
  }, [updateDrafts])

  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (!event.key || !event.key.startsWith(CHECK_IN_DRAFT_PREFIX)) {
        return
      }
      updateDrafts()
    }

    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener('storage', handler)
    }
  }, [updateDrafts])

  if (isLoading) {
    return (
      <div className="contents">
        <div className="flex justify-between items-start gap-4 p-3 rounded-lg bg-gray-100/60 dark:bg-gray-700/40 animate-pulse">
          <div className="flex flex-col gap-1 flex-1">
            <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-3/4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
          </div>
          <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
        <div className="flex justify-between items-start gap-4 p-3 rounded-lg text-gray-400 dark:text-gray-500 animate-pulse">
          <div className="flex flex-col gap-1 flex-1">
            <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-3/4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
          </div>
          <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="col-span-2 text-red-500 text-center p-6 rounded-lg border border-red-500/20 bg-red-500/5">
        <p>Unable to load check-ins: {error}</p>
      </div>
    )
  }

  return (
    <div className="contents">
      <SlotCardNew
        variant="morning"
        state={morning}
        isViewingToday={isViewingToday}
        targetDate={targetDate}
        hasDraft={drafts.morning}
      />
      <SlotCardNew
        variant="evening"
        state={evening}
        isViewingToday={isViewingToday}
        targetDate={targetDate}
        hasDraft={drafts.evening}
      />
    </div>
  )
}

interface SlotCardNewProps {
  variant: 'morning' | 'evening'
  state: CheckInSlotState
  isViewingToday: boolean
  targetDate: Date
  hasDraft: boolean
}

function SlotCardNew({ variant, state, isViewingToday, targetDate, hasDraft }: SlotCardNewProps) {
  const href = variant === 'morning' ? '/check-in/morning' : '/check-in/evening'
  const title = variant === 'morning' ? 'Morning check-in' : 'Evening reflection'

  const statusLabel = getStatusLabel(state.status, hasDraft)
  const description = getStatusDescription({
    variant,
    state,
    isViewingToday,
    targetDate,
    hasDraft,
  })

  const showAction = state.status === 'available'
  const isAvailable = state.status === 'available'
  const isCompleted = state.status === 'completed'
  const displayStatusLabel = isCompleted ? statusLabel : 'Not recorded'

  const cardContent = (
    <>
      <div className="flex flex-col gap-1">
        <p className={cn(
          'text-lg font-bold',
          isAvailable
            ? 'text-gray-800 dark:text-gray-100'
            : 'text-gray-400 dark:text-gray-500'
        )}>
          {title}
        </p>
        <p className={cn(
          'text-sm',
          isAvailable
            ? 'text-gray-600 dark:text-gray-300'
            : 'text-gray-400 dark:text-gray-500'
        )}>
          {description}
        </p>
      </div>
      <div className={cn(
        'px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap',
        'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
      )}>
        {displayStatusLabel}
      </div>
    </>
  )

  if (showAction) {
    return (
      <GuardedLink href={href} className="block">
        <div
          data-slot={variant}
          className={cn(
            'flex justify-between items-start gap-4 p-3 rounded-lg cursor-pointer',
            'bg-gray-100/60 dark:bg-gray-700/40 hover:bg-gray-200/60 dark:hover:bg-gray-700/60 transition-colors'
          )}
        >
          {cardContent}
        </div>
      </GuardedLink>
    )
  }

  return (
    <div
      data-slot={variant}
      className={cn(
        'flex justify-between items-start gap-4 p-3 rounded-lg',
        'text-gray-400 dark:text-gray-500'
      )}
    >
      {cardContent}
    </div>
  )
}

function getStatusLabel(status: CheckInSlotState['status'], hasDraft: boolean) {
  if (status === 'available' && hasDraft) {
    return 'Draft saved'
  }
  switch (status) {
    case 'completed':
      return 'Completed'
    case 'available':
      return 'Available'
    case 'locked':
      return 'Locked'
    case 'upcoming':
      return 'Opens soon'
    case 'closed':
      return 'Closed'
    default:
      return 'Not recorded'
  }
}

interface StatusDescriptionArgs {
  variant: 'morning' | 'evening'
  state: CheckInSlotState
  isViewingToday: boolean
  targetDate: Date
  hasDraft: boolean
}

function getStatusDescription(args: StatusDescriptionArgs) {
  const { variant, state, isViewingToday, targetDate } = args

  switch (state.status) {
    case 'completed':
      return isViewingToday
        ? 'Thanks for checking in today.'
        : 'This check-in was completed on this date.'
    case 'available':
      return variant === 'morning'
        ? 'Start your day with a quick reflection.'
        : 'Return this evening to reflect on your day.'
    case 'locked':
      return `Evening reflections open later today.`
    case 'upcoming':
      return `Morning check-ins open soon.`
    case 'closed':
      return 'Come back tomorrow for a fresh start.'
    default:
      if (isViewingToday) {
        return variant === 'morning'
          ? 'Start your day with a quick reflection once the window opens.'
          : 'Return this evening to reflect on your day.'
      }
      return `No check-in was recorded for ${targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`
  }
}

