'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  type CheckInSlotState,
  useDailyCheckIns,
  MORNING_START_HOUR,
  EVENING_START_HOUR,
} from '@/hooks/useDailyCheckIns'
import { GuardedLink } from '@/components/common/GuardedLink'
import { cn } from '@/lib/utils'
import { CHECK_IN_DRAFT_PREFIX } from '@/lib/check-ins/shared'

interface DraftState {
  morning: boolean
  evening: boolean
}

interface CheckInCardsHeadspaceProps {
  selectedDate?: Date
}

export function CheckInCardsHeadspace({ selectedDate = new Date() }: CheckInCardsHeadspaceProps) {
  const { isLoading, error, refetch, isViewingToday, targetDate, morning, evening } =
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
    return <CheckInCardsSkeleton />
  }

  if (error) {
    return (
      <div className="hs-card p-6 text-center">
        <div className="text-[var(--hs-text-secondary)] mb-3">Unable to load check-ins</div>
        <button
          onClick={refetch}
          className="hs-btn-secondary text-sm px-4 py-2"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <CheckInCard
        variant="morning"
        state={morning}
        isViewingToday={isViewingToday}
        targetDate={targetDate}
        hasDraft={drafts.morning}
      />
      <CheckInCard
        variant="evening"
        state={evening}
        isViewingToday={isViewingToday}
        targetDate={targetDate}
        hasDraft={drafts.evening}
      />
    </div>
  )
}

interface CheckInCardProps {
  variant: 'morning' | 'evening'
  state: CheckInSlotState
  isViewingToday: boolean
  targetDate: Date
  hasDraft: boolean
}

function CheckInCard({ variant, state, isViewingToday, targetDate, hasDraft }: CheckInCardProps) {
  const href = variant === 'morning' ? '/check-in/morning' : '/check-in/evening'

  const config = variant === 'morning'
    ? {
        icon: 'wb_sunny',
        title: 'Morning check-in',
        subtitle: 'Start your day mindfully',
        gradientClass: 'hs-card-morning',
        accentColor: 'var(--hs-morning-accent)',
        iconBg: 'bg-[var(--hs-warm)]/20',
      }
    : {
        icon: 'dark_mode',
        title: 'Evening reflection',
        subtitle: 'Reflect on your day',
        gradientClass: 'hs-card-evening',
        accentColor: 'var(--hs-evening-accent)',
        iconBg: 'bg-[var(--hs-evening-accent)]/20',
      }

  const description = getStatusDescription({
    variant,
    state,
    isViewingToday,
    targetDate,
    hasDraft,
  })

  const isAvailable = state.status === 'available'
  const isCompleted = state.status === 'completed'
  const isLocked = state.status === 'locked' || state.status === 'upcoming'
  const actionLabel = hasDraft ? 'Continue' : 'Begin'

  // Completed state
  if (isCompleted) {
    return (
      <div className={cn('hs-card p-5', config.gradientClass, 'opacity-75')}>
        <div className="flex items-start gap-4">
          <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', config.iconBg)}>
            <span className="material-symbols-outlined text-2xl" style={{ color: config.accentColor }}>
              check_circle
            </span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-[var(--hs-text-primary)]">
              {config.title}
            </h3>
            <p className="text-sm text-[var(--hs-text-secondary)] mt-1">
              {description}
            </p>
            <div className="mt-3">
              <span className="hs-chip text-xs">Completed</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Locked/upcoming state
  if (isLocked) {
    return (
      <div className="hs-card p-5 bg-[var(--hs-surface)]">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[var(--hs-border-subtle)]">
            <span className="material-symbols-outlined text-2xl text-[var(--hs-text-tertiary)]">
              schedule
            </span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-[var(--hs-text-tertiary)]">
              {config.title}
            </h3>
            <p className="text-sm text-[var(--hs-text-tertiary)] mt-1">
              {description}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Available state (interactive)
  return (
    <GuardedLink href={href} className="block">
      <div className={cn('hs-card-interactive p-5', config.gradientClass)}>
        <div className="flex items-start gap-4">
          <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', config.iconBg)}>
            <span className="material-symbols-outlined text-2xl" style={{ color: config.accentColor }}>
              {config.icon}
            </span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-[var(--hs-text-primary)]">
              {config.title}
            </h3>
            <p className="text-sm text-[var(--hs-text-secondary)] mt-1">
              {config.subtitle}
            </p>

            {hasDraft && (
              <div className="mt-2">
                <span className="hs-chip-warm text-xs">Draft saved</span>
              </div>
            )}
          </div>

          {/* Action button */}
          <div className="flex items-center self-center">
            <span
              className="inline-flex items-center justify-center w-10 h-10 rounded-full transition-transform hover:scale-105"
              style={{ backgroundColor: config.accentColor }}
            >
              <span className="material-symbols-outlined text-white text-xl">
                arrow_forward
              </span>
            </span>
          </div>
        </div>
      </div>
    </GuardedLink>
  )
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
        : 'Completed on this date.'
    case 'available':
      if (hasDraft) {
        return 'Continue where you left off.'
      }
      return variant === 'morning'
        ? 'A few minutes to set your intentions.'
        : 'Take a moment to reflect on your day.'
    case 'locked':
      return `Opens at ${formatAvailableTime(state.availableAt, variant)}`
    case 'upcoming':
      return `Opens at ${formatAvailableTime(state.availableAt, variant)}`
    case 'closed':
      return 'This window has closed.'
    default:
      if (isViewingToday) {
        return variant === 'morning'
          ? 'Available when the window opens.'
          : 'Available this evening.'
      }
      return `No check-in on ${formatDisplayDate(targetDate)}.`
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

function CheckInCardsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* Morning skeleton */}
      <div className="hs-card p-5 hs-card-morning animate-pulse">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/30" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-white/30 rounded w-1/2" />
            <div className="h-4 bg-white/20 rounded w-3/4" />
          </div>
          <div className="w-10 h-10 rounded-full bg-white/30" />
        </div>
      </div>

      {/* Evening skeleton */}
      <div className="hs-card p-5 hs-card-evening animate-pulse">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/30" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-white/30 rounded w-1/2" />
            <div className="h-4 bg-white/20 rounded w-3/4" />
          </div>
          <div className="w-10 h-10 rounded-full bg-white/30" />
        </div>
      </div>
    </div>
  )
}
