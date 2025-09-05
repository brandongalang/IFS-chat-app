'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { GuardedLink } from '@/components/common/GuardedLink'

export function CheckInCard() {
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'evening' | 'none'>('none')

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour >= 4 && hour < 12) {
      setTimeOfDay('morning')
    } else if (hour >= 16 && hour < 22) {
      setTimeOfDay('evening')
    }
  }, [])

  if (timeOfDay === 'none') {
    return (
        <div className="col-span-2 rounded-xl border border-border bg-muted p-4">
            <div className="text-base font-medium">Come back later</div>
            <div className="text-xs text-muted-foreground mt-1">Check-ins are available in the morning and evening.</div>
        </div>
    )
  }

  const isMorning = timeOfDay === 'morning'

  return (
    <div className={`col-span-2 rounded-xl border border-border p-4 ${isMorning ? 'bg-green-600 text-white' : 'bg-indigo-600 text-white'}`}>
      <div className="text-xs opacity-90">{isMorning ? 'Morning' : 'Evening'}</div>
      <div className="text-lg font-semibold">{isMorning ? 'Fresh start!' : 'Daily review'}</div>
      <GuardedLink href="/check-in">
        <Button className="mt-4 bg-white text-black hover:bg-white/90">
          Begin
        </Button>
      </GuardedLink>
    </div>
  )
}
