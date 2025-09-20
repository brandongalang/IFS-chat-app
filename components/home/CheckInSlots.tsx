'use client'

import {
  CheckInSlotState,
  useDailyCheckIns,
  MORNING_START_HOUR,
  EVENING_START_HOUR,
} from '@/hooks/useDailyCheckIns'
import { Button } from '@/components/ui/button'
import { GuardedLink } from '@/components/common/GuardedLink'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface CheckInSlotsProps {
  selectedDate?: Date
}

const SLOT_CARD_BASE_CLASS = 'col-span-2 md:col-span-1 rounded-xl border p-4'

export function CheckInSlots({ selectedDate = new Date() }: CheckInSlotsProps) {
  const { isLoading, error, refetch, isViewingToday, targetDate, morning, evening } = useDailyCheckIns(selectedDate)

  if (isLoading) {
    return <CheckInSlotsSkeleton />
  }

  if (error) {
    return (
      <div className="col-span-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        <div className="text-base font-semibold">Unable to load check-ins</div>
        <div className="mt-1 text-xs text-destructive/80">{error}</div>
        <Button
          variant="outline"
          className="mt-4 border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={refetch}
        >
          Try again
        </Button>
      </div>
    )
  }

  return (
    <>
      <MorningSlotCard
        state={morning}
        isViewingToday={isViewingToday}
        targetDate={targetDate}
      />
      <EveningSlotCard
        state={evening}
        isViewingToday={isViewingToday}
        targetDate={targetDate}
      />
    </>
  )
}

function CheckInSlotsSkeleton() {
  return (
    <>
      <div className="col-span-2 md:col-span-1 rounded-xl border border-border bg-muted p-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="mt-3 h-6 w-2/3" />
        <Skeleton className="mt-6 h-9 w-24" />
      </div>
      <div className="col-span-2 md:col-span-1 rounded-xl border border-border bg-muted p-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="mt-3 h-6 w-2/3" />
        <Skeleton className="mt-6 h-9 w-24" />
      </div>
    </>
  )
}

interface SlotCardProps {
  state: CheckInSlotState
  isViewingToday: boolean
  targetDate: Date
}

function MorningSlotCard({ state, isViewingToday, targetDate }: SlotCardProps) {
  if (state.status === 'completed') {
    return (
      <div
        data-testid="check-in-morning-card"
        data-slot="morning"
        data-state="completed"
        className={cn(SLOT_CARD_BASE_CLASS, 'border-border bg-emerald-600 text-white')}
      >
        <div className="text-xs uppercase tracking-wide opacity-90">Morning</div>
        <div className="mt-1 text-lg font-semibold">Morning check-in complete</div>
        <p className="mt-2 text-sm text-emerald-100/90">
          {isViewingToday ? 'Great work today.' : 'Morning reflection was completed on this day.'}
        </p>
      </div>
    )
  }

  if (state.status === 'available') {
    return (
      <div
        data-testid="check-in-morning-card"
        data-slot="morning"
        data-state="available"
        className={cn(SLOT_CARD_BASE_CLASS, 'border-border bg-green-600 text-white')}
      >
        <div className="text-xs uppercase tracking-wide opacity-90">Morning</div>
        <div className="mt-1 text-lg font-semibold">Fresh start</div>
        <p className="mt-2 text-sm text-green-100/90">Set your intention and ease into the day.</p>
        <GuardedLink href="/check-in/morning">
          <Button className="mt-4 bg-white text-black hover:bg-white/90">Begin</Button>
        </GuardedLink>
      </div>
    )
  }

  if (state.status === 'upcoming') {
    return (
      <div
        data-testid="check-in-morning-card"
        data-slot="morning"
        data-state="upcoming"
        className={cn(SLOT_CARD_BASE_CLASS, 'border-border bg-muted')}
      >
        <div className="text-xs font-semibold uppercase text-muted-foreground">Morning</div>
        <div className="mt-1 text-base font-semibold">Opens soon</div>
        <p className="mt-2 text-sm text-muted-foreground">
          Morning check-in unlocks at {formatHourLabel(MORNING_START_HOUR)}.
        </p>
      </div>
    )
  }

  if (state.status === 'closed') {
    return (
      <div
        data-testid="check-in-morning-card"
        data-slot="morning"
        data-state="closed"
        className={cn(SLOT_CARD_BASE_CLASS, 'border-border/60 border-dashed bg-muted')}
      >
        <div className="text-xs font-semibold uppercase text-muted-foreground">Morning</div>
        <div className="mt-1 text-base font-semibold text-muted-foreground">Morning check-in closed</div>
        <p className="mt-2 text-sm text-muted-foreground">
          The morning check-in closes at {formatHourLabel(EVENING_START_HOUR)}. Come back tomorrow for a fresh start.
        </p>
      </div>
    )
  }

  return (
    <div
      data-testid="check-in-morning-card"
      data-slot="morning"
      data-state="empty"
      className={cn(SLOT_CARD_BASE_CLASS, 'border-border bg-muted')}
    >
      <div className="text-xs font-semibold uppercase text-muted-foreground">Morning</div>
      <div className="mt-1 text-base font-semibold">No morning check-in</div>
      <p className="mt-2 text-sm text-muted-foreground">
        {isViewingToday
          ? 'Start your day with a quick reflection when the window opens.'
          : `No morning check-in was recorded for ${formatDisplayDate(targetDate)}.`}
      </p>
    </div>
  )
}

function EveningSlotCard({ state, isViewingToday, targetDate }: SlotCardProps) {
  if (state.status === 'completed') {
    return (
      <div
        data-testid="check-in-evening-card"
        data-slot="evening"
        data-state="completed"
        className={cn(SLOT_CARD_BASE_CLASS, 'border-border bg-indigo-600 text-white')}
      >
        <div className="text-xs uppercase tracking-wide opacity-90">Evening</div>
        <div className="mt-1 text-lg font-semibold">Evening reflection complete</div>
        <p className="mt-2 text-sm text-indigo-100/90">
          {isViewingToday ? 'You wrapped up the day with care.' : 'Evening reflection was completed on this day.'}
        </p>
      </div>
    )
  }

  if (state.status === 'available') {
    return (
      <div
        data-testid="check-in-evening-card"
        data-slot="evening"
        data-state="available"
        className={cn(SLOT_CARD_BASE_CLASS, 'border-border bg-indigo-600 text-white')}
      >
        <div className="text-xs uppercase tracking-wide opacity-90">Evening</div>
        <div className="mt-1 text-lg font-semibold">Daily review</div>
        <p className="mt-2 text-sm text-indigo-100/90">Take a moment to wind down your day.</p>
        <GuardedLink href="/check-in/evening">
          <Button className="mt-4 bg-white text-black hover:bg-white/90">Begin</Button>
        </GuardedLink>
      </div>
    )
  }

  if (state.status === 'locked') {
    return (
      <div
        data-testid="check-in-evening-card"
        data-slot="evening"
        data-state="locked"
        className={cn(SLOT_CARD_BASE_CLASS, 'border-border bg-muted')}
      >
        <div className="text-xs font-semibold uppercase text-muted-foreground">Evening</div>
        <div className="mt-1 text-base font-semibold">Unlocks later today</div>
        <p className="mt-2 text-sm text-muted-foreground">
          Evening reflection unlocks at {formatHourLabel(EVENING_START_HOUR)}.
        </p>
      </div>
    )
  }

  return (
    <div
      data-testid="check-in-evening-card"
      data-slot="evening"
      data-state="empty"
      className={cn(SLOT_CARD_BASE_CLASS, 'border-border bg-muted')}
    >
      <div className="text-xs font-semibold uppercase text-muted-foreground">Evening</div>
      <div className="mt-1 text-base font-semibold">No evening check-in</div>
      <p className="mt-2 text-sm text-muted-foreground">
        {isViewingToday
          ? 'Come back this evening to reflect on your day.'
          : `No evening check-in was recorded for ${formatDisplayDate(targetDate)}.`}
      </p>
    </div>
  )
}

function formatDisplayDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

function formatHourLabel(hour24: number) {
  const hour12 = hour24 % 12 || 12
  const suffix = hour24 >= 12 ? 'PM' : 'AM'
  return `${hour12}:00 ${suffix}`
}
