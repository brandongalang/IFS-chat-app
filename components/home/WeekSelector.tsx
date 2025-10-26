'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface DayActivity {
  date: string
  hasCheckIn: boolean
  hasChatActivity: boolean
  isToday: boolean
  isCurrentWeek: boolean
}

interface WeekSelectorProps {
  selectedDate: Date
  onDateChange: (date: Date) => void
  className?: string
}

export function WeekSelector({ selectedDate, onDateChange, className }: WeekSelectorProps) {
  const [weekDays, setWeekDays] = useState<DayActivity[]>([])
  const [_loading, setLoading] = useState(true)
  
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
    setLoading(true)
    const supabase = createClient()
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const days = getCurrentWeek()
      const startDate = days[0].date
      const endDate = days[6].date

      // Fetch check-ins for the week
      const { data: checkIns } = await supabase
        .from('check_ins')
        .select('check_in_date')
        .eq('user_id', user.id)
        .gte('check_in_date', startDate)
        .lte('check_in_date', endDate)

      // Fetch chat sessions for the week
      const { data: sessions } = await supabase
        .from('sessions')
        .select('start_time')
        .eq('user_id', user.id)
        .gte('start_time', startDate + 'T00:00:00.000Z')
        .lte('start_time', endDate + 'T23:59:59.999Z')

      // Mark days with activity
      const checkInDates = new Set(checkIns?.map(ci => ci.check_in_date) || [])
      const chatDates = new Set(
        sessions?.map(s => new Date(s.start_time).toISOString().split('T')[0]) || []
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
      setLoading(false)
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

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const selectedDateIso = selectedDate.toISOString().split('T')[0]
  const isViewingCurrentWeek = weekDays.some((day) => day.isToday)
  const formatRange = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  const rangeLabel =
    weekDays.length >= 7 ? `${formatRange(weekDays[0].date)} – ${formatRange(weekDays[6].date)}` : ''

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between rounded-2xl bg-card/80 px-4 py-3 shadow-sm ring-1 ring-border/60">
        <button
          type="button"
          onClick={() => navigateWeek('prev')}
          className="inline-flex size-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label="View previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-muted-foreground">
            This week
          </span>
          <span className="text-sm font-medium text-foreground">{rangeLabel}</span>
        </div>

        <div className="flex items-center gap-2">
          {!isViewingCurrentWeek ? (
            <button
              type="button"
              onClick={goToToday}
              className="rounded-full bg-accent/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-foreground transition hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Today
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => navigateWeek('next')}
            className="inline-flex size-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="View next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
        {weekDays.map((day, index) => {
          const date = new Date(`${day.date}T00:00:00`)
          const dayNumber = date.getDate()
          const hasActivity = day.hasCheckIn || day.hasChatActivity
          const isSelected = day.date === selectedDateIso

          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onDateChange(date)}
              className={cn(
                'group flex flex-col items-center gap-2 rounded-2xl bg-card/70 px-2 py-3 ring-1 ring-border/40 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                isSelected && 'bg-primary/15 text-foreground ring-primary/40',
                day.isToday && !isSelected && 'ring-2 ring-primary/30',
              )}
              aria-pressed={isSelected}
            >
              <span className="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-muted-foreground group-hover:text-foreground/80">
                {dayNames[index]}
              </span>
              <span className="relative text-base font-semibold text-foreground">
                {dayNumber}
                {hasActivity ? (
                  <span className="absolute -bottom-2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-primary/80" aria-hidden />
                ) : null}
                {day.isToday ? (
                  <span className="absolute -top-2 right-0 flex size-2 rounded-full bg-accent/70" aria-hidden />
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}