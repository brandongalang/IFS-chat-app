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
import { CHECK_IN_DRAFT_PREFIX } from '@/lib/check-ins/shared'
import { cn } from '@/lib/utils'

interface DraftState {
  morning: boolean
  evening: boolean
}

interface CheckInArtwork {
  morning: string
  evening: string
}

interface CheckInSlotsProps {
  selectedDate?: Date
  art?: CheckInArtwork
}

const DEFAULT_ART: CheckInArtwork = {
  morning:
    'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80',
  evening:
    'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=80',
}

export function CheckInSlots({
  selectedDate = new Date(),
  art = DEFAULT_ART,
}: CheckInSlotsProps) {
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
      <div className="rounded-3xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-semibold">Unable to load check-ins</p>
            <p className="text-sm">{error}</p>
          </div>
          <Button variant="outline" className="rounded-full px-5" onClick={refetch}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {isViewingToday && streak > 0 ? <StreakBanner streak={streak} /> : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <SlotCard
          variant="morning"
          artUrl={art.morning}
          state={morning}
          isViewingToday={isViewingToday}
          targetDate={targetDate}
          hasDraft={drafts.morning}
        />
        <SlotCard
          variant="evening"
          artUrl={art.evening}
          state={evening}
          isViewingToday={isViewingToday}
          targetDate={targetDate}
          hasDraft={drafts.evening}
        />
      </div>
    </div>
  )
}

interface SlotCardProps {
  variant: 'morning' | 'evening'
  artUrl: string
  state: CheckInSlotState
  isViewingToday: boolean
  targetDate: Date
  hasDraft: boolean
}

function SlotCard({ variant, artUrl, state, isViewingToday, targetDate, hasDraft }: SlotCardProps) {
  const href = variant === 'morning' ? '/check-in/morning' : '/check-in/evening'
  const title = variant === 'morning' ? 'Morning Check-in' : 'Evening Reflection'

  const statusLabel = getStatusLabel(state.status, hasDraft)
  const statusTone = getStatusTone(state.status, hasDraft)

  const description = getStatusDescription({
    variant,
    state,
    isViewingToday,
    targetDate,
    hasDraft,
  })

  const showAction = state.status === 'available'
  const actionLabel = hasDraft
    ? 'Resume check-in'
    : variant === 'morning'
      ? 'Begin morning check-in'
      : 'Begin evening reflection'

  return (
    <article className="group relative overflow-hidden rounded-3xl bg-card shadow-lg shadow-primary/10 ring-1 ring-border/60 transition hover:shadow-xl">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
        <div className="relative h-48 w-full overflow-hidden bg-muted sm:h-56 lg:h-auto">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${artUrl})` }}
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-background/20 via-background/5 to-transparent" />
        </div>
        <div className="flex flex-col gap-4 p-6 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
                {variant === 'morning' ? 'Morning' : 'Evening'}
              </p>
              <h3 className="mt-2 text-xl font-semibold text-foreground">{title}</h3>
            </div>
            <StatusTag tone={statusTone}>{statusLabel}</StatusTag>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          {showAction ? (
            <GuardedLink href={href} className="mt-2 inline-flex">
              <Button
                className="w-full rounded-full bg-primary px-6 py-2.5 text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/60 sm:w-auto"
              >
                {actionLabel}
              </Button>
            </GuardedLink>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function getStatusLabel(status: CheckInSlotState['status'], hasDraft: boolean) {
  if (status === 'available' && hasDraft) {
    return 'Draft in progress'
  }
  switch (status) {
    case 'completed':
      return 'Completed'
    case 'available':
      return 'Available now'
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

function getStatusTone(status: CheckInSlotState['status'], hasDraft: boolean): 'success' | 'notice' | 'muted' {
  if (status === 'completed') return 'success'
  if (status === 'available' && hasDraft) return 'notice'
  if (status === 'available') return 'notice'
  if (status === 'locked' || status === 'upcoming') return 'muted'
  return 'muted'
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
        ? 'Thanks for checking in today. Take a breath and carry this momentum forward.'
        : 'This check-in was completed on this date.'
    case 'available':
      if (hasDraft) {
        return 'Pick up where you left off and finish when you are ready.'
      }
      return variant === 'morning'
        ? 'Ease into the day with a gentle reflection on how you are arriving.'
        : 'Wind down by noticing what stood out today and how you are feeling now.'
    case 'locked':
      return `Evening reflections open later today at ${formatAvailableTime(state.availableAt, variant)}.`
    case 'upcoming':
      return `Morning check-ins open at ${formatAvailableTime(state.availableAt, variant)}.`
    case 'closed':
      return 'Come back tomorrow for a fresh start.'
    default:
      if (isViewingToday) {
        return variant === 'morning'
          ? 'Start your day with a short reflection once the window opens.'
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
    <div className="space-y-6">
      <div className="h-28 w-full rounded-3xl bg-card/60 ring-1 ring-border/40" />
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((key) => (
          <div key={key} className="overflow-hidden rounded-3xl bg-card/60 ring-1 ring-border/40">
            <Skeleton className="h-48 w-full" />
            <div className="space-y-3 p-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StreakBanner({ streak }: { streak: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-primary/30 bg-primary/10 p-6 text-primary sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-primary/70">Momentum</p>
        <p className="mt-2 text-sm text-primary/90">
          You are on a {streak}-day check-in streak. Keep the rhythm going.
        </p>
      </div>
      <div className="text-3xl" aria-hidden>
        🔥
      </div>
    </div>
  )
}

function StatusTag({ tone, children }: { tone: 'success' | 'notice' | 'muted'; children: React.ReactNode }) {
  const base = 'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]'
  const toneClass = {
    success: 'bg-primary/20 text-primary',
    notice: 'bg-accent/35 text-foreground/85',
    muted: 'bg-muted text-muted-foreground',
  }[tone]

  return <span className={cn(base, toneClass)}>{children}</span>
}
