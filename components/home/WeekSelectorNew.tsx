'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface DayActivity {
  date: string
  hasCheckIn: boolean
  hasChatActivity: boolean
  isToday: boolean
  isCurrentWeek: boolean
}

interface WeekSelectorNewProps {
  selectedDate: Date
  onDateChange: (date: Date) => void
  className?: string
}

export function WeekSelectorNew({ selectedDate, onDateChange, className }: WeekSelectorNewProps) {
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

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const isCurrentWeekSelected = weekDays.some(day => day.isCurrentWeek)

  const weekStart = weekDays[0] ? new Date(weekDays[0].date + 'T00:00:00') : null
  const weekEnd = weekDays[6] ? new Date(weekDays[6].date + 'T00:00:00') : null
  const weekRange = weekStart && weekEnd
    ? `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : ''

  return (
    <div className={className}>
      {/* Week Navigation */}
      <div className="flex justify-between items-center py-2">
        <button
          onClick={() => navigateWeek('prev')}
          className="text-2xl text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          aria-label="Previous week"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          {weekRange} {isCurrentWeekSelected && <span className="text-gray-500 dark:text-gray-400">Today</span>}
        </p>
        
        <button
          onClick={() => navigateWeek('next')}
          className="text-2xl text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          aria-label="Next week"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      {/* Week Calendar */}
      <div className="grid grid-cols-7 gap-2 text-center text-sm">
        {weekDays.map((day, index) => {
          const date = new Date(day.date + 'T00:00:00')
          const dayNumber = date.getDate()
          
          return (
            <div key={day.date} className="flex flex-col gap-1 items-center">
              <span className="text-gray-600 dark:text-gray-400">{dayNames[index]}</span>
              <div
                className={`flex items-center justify-center w-9 h-9 rounded-lg ${
                  day.isToday
                    ? 'bg-primary dark:bg-primary text-white font-semibold'
                    : 'bg-gray-200/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-200'
                }`}
              >
                {dayNumber}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

