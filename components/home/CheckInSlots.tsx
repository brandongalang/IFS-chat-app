'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  type CheckInSlotState,
  useDailyCheckIns,
  MORNING_START_HOUR,
  EVENING_START_HOUR,
} from '@/hooks/useDailyCheckIns'
import { Button } from '@/components/ui/button'
import { GuardedLink } from '@/components/common/GuardedLink'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CHECK_IN_DRAFT_PREFIX } from '@/lib/check-ins/shared'
import { cn } from '@/lib/utils'

interface DraftState {
  morning: boolean
  evening: boolean
}

interface CheckInSlotsProps {
  selectedDate?: Date
}

export function CheckInSlots({ selectedDate = new Date() }: CheckInSlotsProps) {
  const { isLoading, error, refetch, isViewingToday, targetDate, morning, evening, streak } =
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
    return <CheckInSlotsSkeleton />
  }

  if (error) {
    return (
      <div className="col-span-2">
        <Alert variant="destructive">
          <AlertTitle>Unable to load check-ins</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-3" onClick={refetch}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <>
      <SlotCard
        variant="morning"
        state={morning}
        isViewingToday={isViewingToday}
        targetDate={targetDate}
        hasDraft={drafts.morning}
      />
      <SlotCard
        variant="evening"
        state={evening}
        isViewingToday={isViewingToday}
        targetDate={targetDate}
        hasDraft={drafts.evening}
      />
    </>
  )
}

interface SlotCardProps {
  variant: 'morning' | 'evening'
  state: CheckInSlotState
  isViewingToday: boolean
  targetDate: Date
  hasDraft: boolean
}

function SlotCard({ variant, state, isViewingToday, targetDate, hasDraft }: SlotCardProps) {
  const href = variant === 'morning' ? '/check-in/morning' : '/check-in/evening'
  const title = variant === 'morning' ? 'Morning check-in' : 'Evening reflection'

  const statusLabel = getStatusLabel(state.status, hasDraft)
  const statusVariant = getStatusBadgeVariant(state.status, hasDraft)

  const description = getStatusDescription({
    variant,
    state,
    isViewingToday,
    targetDate,
    hasDraft,
  })

  const showAction = state.status === 'available'
  const actionLabel = hasDraft ? 'Resume' : 'Begin'

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

function getStatusBadgeVariant(
  status: CheckInSlotState['status'],
  hasDraft: boolean,
): 'default' | 'secondary' | 'outline' {
  if (status === 'completed') return 'default'
  if (status === 'available' && hasDraft) return 'secondary'
  if (status === 'available') return 'default'
  return 'outline'
}

interface StatusDescriptionArgs {
  variant: 'morning' | 'evening'
  state: CheckInSlotState
  isViewingToday: boolean
  targetDate: Date
  hasDraft: boolean
}

function getStatusDescription(args: StatusDescriptionArgs) {
  const { variant, state, isViewingToday, targetDate, hasDraft } = args

  switch (state.status) {
    case 'completed':
      return isViewingToday
        ? 'Thanks for checking in today.'
        : 'This check-in was completed on this date.'
    case 'available':
      if (hasDraft) {
        return 'Pick up where you left off and finish this check-in when you are ready.'
      }
      return variant === 'morning'
        ? 'Ease into the day with a quick reflection.'
        : 'Wind down the day with a gentle review.'
    case 'locked':
      return `Evening reflections open later today at ${formatAvailableTime(state.availableAt, variant)}.`
    case 'upcoming':
      return `Morning check-ins open at ${formatAvailableTime(state.availableAt, variant)}.`
    case 'closed':
      return 'Come back tomorrow for a fresh start.'
    default:
      if (isViewingToday) {
        return variant === 'morning'
          ? 'Start your day with a quick reflection once the window opens.'
          : 'Return this evening to reflect on your day.'
      }
      return `No check-in was recorded for ${formatDisplayDate(targetDate)}.`
  }
}

function formatAvailableTime(time: string | null | undefined, variant: 'morning' | 'evening') {
  if (time) {
    const [hourString, minuteString] = time.split(':')
    const hour = parseInt(hourString ?? '0', 10)
    const minute = parseInt(minuteString ?? '0', 10)
    return formatTimeLabel(hour, minute)
  }
  const fallbackHour = variant === 'morning' ? MORNING_START_HOUR : EVENING_START_HOUR
  return formatTimeLabel(fallbackHour, 0)
}

function formatDisplayDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

function formatTimeLabel(hour24: number, minute: number) {
  const hour = Number.isFinite(hour24) ? hour24 : 0
  const minuteClamped = Number.isFinite(minute) ? Math.max(0, Math.min(59, minute)) : 0
  const hour12 = (hour % 12 + 12) % 12 || 12
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const minuteLabel = String(minuteClamped).padStart(2, '0')
  return `${hour12}:${minuteLabel} ${suffix}`
}

function CheckInSlotsSkeleton() {
  return (
    <>
      <div className="col-span-2 rounded-2xl border border-border/60 bg-card/40 p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-6 w-1/2" />
        <Skeleton className="mt-4 h-9 w-28" />
      </div>
      <div className="col-span-2 md:col-span-1 rounded-2xl border border-border/60 bg-card/40 p-5">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-2 h-5 w-3/4" />
        <Skeleton className="mt-5 h-10 w-full" />
      </div>
      <div className="col-span-2 md:col-span-1 rounded-2xl border border-border/60 bg-card/40 p-5">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-2 h-5 w-3/4" />
        <Skeleton className="mt-5 h-10 w-full" />
      </div>
    </>
  )
}

function StreakBanner({ streak }: { streak: number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Momentum</p>
        <p className="mt-1 text-sm text-muted-foreground">
          You are on a {streak}-day check-in streak. Keep the rhythm going.
        </p>
      </div>
      <div className="text-2xl" aria-hidden>
        🔥
      </div>
    </div>
  )
}
