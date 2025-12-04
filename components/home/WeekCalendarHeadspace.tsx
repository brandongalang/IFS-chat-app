'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface DayActivity {
  date: string
  hasCheckIn: boolean
  hasChatActivity: boolean
  isToday: boolean
  isCurrentWeek: boolean
}

interface WeekCalendarHeadspaceProps {
  selectedDate: Date
  onDateChange: (date: Date) => void
  className?: string
}

export function WeekCalendarHeadspace({
  selectedDate,
  onDateChange,
  className
}: WeekCalendarHeadspaceProps) {
  const [weekDays, setWeekDays] = useState<DayActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const getWeekStart = useCallback((date: Date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day
    return new Date(d.setDate(diff))
  }, [])

  const getCurrentWeek = useCallback(() => {
    const startOfWeek = getWeekStart(selectedDate)
    const days: DayActivity[] = []
    const today = new Date()
    const currentWeekStart = getWeekStart(today)

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)

      const dateString = date.toISOString().split('T')[0]
      const isToday = dateString === today.toISOString().split('T')[0]
      const isCurrentWeek = startOfWeek.getTime() === currentWeekStart.getTime()

      days.push({
        date: dateString,
        hasCheckIn: false,
        hasChatActivity: false,
        isToday,
        isCurrentWeek
      })
    }

    return days
  }, [selectedDate, getWeekStart])

  const fetchWeekActivity = useCallback(async () => {
    setIsLoading(true)
    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setWeekDays(getCurrentWeek())
        return
      }

      const days = getCurrentWeek()
      const startDate = days[0].date
      const endDate = days[6].date

      const { data: checkIns } = await supabase
        .from('check_ins')
        .select('check_in_date')
        .eq('user_id', user.id)
        .gte('check_in_date', startDate)
        .lte('check_in_date', endDate)

      const { data: sessions } = await supabase
        .from('sessions_v2')
        .select('started_at')
        .eq('user_id', user.id)
        .gte('started_at', startDate + 'T00:00:00.000Z')
        .lte('started_at', endDate + 'T23:59:59.999Z')

      const checkInDates = new Set(checkIns?.map(ci => ci.check_in_date) || [])
      const chatDates = new Set(
        sessions?.map(s => new Date(s.started_at).toISOString().split('T')[0]) || []
      )

      const updatedDays = days.map(day => ({
        ...day,
        hasCheckIn: checkInDates.has(day.date),
        hasChatActivity: chatDates.has(day.date)
      }))

      setWeekDays(updatedDays)
    } catch (error) {
      console.error('Failed to fetch week activity:', error)
      setWeekDays(getCurrentWeek())
    } finally {
      setIsLoading(false)
    }
  }, [getCurrentWeek])

  useEffect(() => {
    fetchWeekActivity()
  }, [fetchWeekActivity])

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    onDateChange(newDate)
  }

  const goToToday = () => {
    onDateChange(new Date())
  }

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const isCurrentWeekSelected = weekDays.some(day => day.isCurrentWeek)

  const weekStart = weekDays[0] ? new Date(weekDays[0].date + 'T00:00:00') : null
  const monthYear = weekStart
    ? weekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : ''

  return (
    <div className={cn('hs-card p-4', className)}>
      {/* Header with navigation */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => navigateWeek('prev')}
          className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--hs-text-secondary)] hover:bg-[var(--hs-surface)] transition-colors"
          aria-label="Previous week"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>

        <div className="flex flex-col items-center">
          <span className="text-base font-semibold text-[var(--hs-text-primary)]">
            {monthYear}
          </span>
          {!isCurrentWeekSelected && (
            <button
              onClick={goToToday}
              className="text-xs font-medium text-[var(--hs-primary)] hover:text-[var(--hs-primary-dark)] mt-0.5"
            >
              Back to today
            </button>
          )}
        </div>

        <button
          onClick={() => navigateWeek('next')}
          className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--hs-text-secondary)] hover:bg-[var(--hs-surface)] transition-colors"
          aria-label="Next week"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      {/* Week days */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day, index) => {
          const date = new Date(day.date + 'T00:00:00')
          const dayNumber = date.getDate()
          const hasActivity = day.hasCheckIn || day.hasChatActivity

          return (
            <div key={day.date} className="flex flex-col items-center gap-1.5">
              {/* Day name */}
              <span className="text-xs font-medium text-[var(--hs-text-tertiary)]">
                {dayNames[index]}
              </span>

              {/* Day number */}
              <button
                onClick={() => onDateChange(date)}
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200',
                  day.isToday
                    ? 'bg-[var(--hs-primary)] text-white shadow-glow'
                    : hasActivity
                      ? 'bg-[var(--hs-primary-muted)] text-[var(--hs-primary)] hover:bg-[var(--hs-primary)] hover:text-white'
                      : 'text-[var(--hs-text-primary)] hover:bg-[var(--hs-surface)]'
                )}
              >
                {isLoading ? (
                  <span className="w-4 h-4 rounded-full bg-[var(--hs-surface)] animate-pulse" />
                ) : (
                  dayNumber
                )}
              </button>

              {/* Activity indicator */}
              <div className="h-1.5 flex items-center justify-center">
                {hasActivity && !day.isToday && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--hs-warm)]" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
