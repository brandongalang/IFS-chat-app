'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
        .from('sessions_v2')
        .select('started_at')
        .eq('user_id', user.id)
        .gte('started_at', startDate + 'T00:00:00.000Z')
        .lte('started_at', endDate + 'T23:59:59.999Z')

      // Mark days with activity
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
  const isCurrentWeekSelected = weekDays.some(day => day.isCurrentWeek)

  return (
    <div className={className}>
      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateWeek('prev')}
          className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {weekDays[0] ? new Date(weekDays[0].date + 'T00:00:00').toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            }) : ''} - {weekDays[6] ? new Date(weekDays[6].date + 'T00:00:00').toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            }) : ''}
          </span>

          {!isCurrentWeekSelected && (
            <Button
              variant="ghost"
              size="sm"
              onClick={goToToday}
              className="h-6 px-2 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50"
            >
              Today
            </Button>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateWeek('next')}
          className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week Calendar */}
      <div className="grid grid-cols-7 gap-2 text-center text-xs text-gray-500">
        {weekDays.map((day, index) => {
          const date = new Date(day.date + 'T00:00:00')
          const dayNumber = date.getDate()
          const hasActivity = day.hasCheckIn || day.hasChatActivity

          return (
            <div key={day.date} className="flex flex-col gap-1">
              <span>{dayNames[index]}</span>
              <div
                className={`
                  relative rounded-md py-2 px-1 transition-all duration-200
                  ${day.isToday
                    ? 'bg-orange-100 border border-orange-300 shadow-[0_0_0_1px_rgba(249,115,22,0.2)]'
                    : 'border border-gray-200 bg-white'
                  }
                  ${hasActivity ? 'hover:bg-orange-50' : 'hover:bg-gray-50'}
                `}
              >
                <div className="relative">
                  <span className={day.isToday ? 'text-orange-700 font-semibold' : 'text-gray-700'}>
                    {dayNumber}
                  </span>

                  {/* Streak indicator */}
                  {hasActivity && (
                    <div className="absolute -top-1 -right-1">
                      <div className="w-2 h-2 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 shadow-sm">
                        <div className="w-full h-full rounded-full bg-white/30 animate-pulse" />
                      </div>
                    </div>
                  )}

                  {/* Current day glow effect */}
                  {day.isToday && (
                    <div className="absolute inset-0 rounded-md bg-orange-500/5 animate-pulse" />
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}