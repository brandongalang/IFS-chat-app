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
        <div className="col-span-2 rounded-xl border border-ethereal-border bg-ethereal-bg-1 p-4">
            <div className="text-base font-medium text-ethereal-text-assistant">Come back later</div>
            <div className="text-xs mt-1 text-ethereal-text-user">Check-ins are available in the morning and evening.</div>
        </div>
    )
  }

  const isMorning = timeOfDay === 'morning'
  const gradientClass = isMorning
    ? 'from-ethereal-gradient-from-morning to-ethereal-gradient-to-morning'
    : 'from-ethereal-gradient-from-evening to-ethereal-gradient-to-evening'

  return (
    <div
      className={`col-span-2 rounded-xl border border-ethereal-border p-4 bg-gradient-to-br text-ethereal-text-assistant ${gradientClass}`}
    >
      <div className="text-xs opacity-90 text-ethereal-text-user">{isMorning ? 'Morning' : 'Evening'}</div>
      <div className="text-lg font-semibold">{isMorning ? 'Fresh start!' : 'Daily review'}</div>
      <GuardedLink href="/check-in">
        <Button className="mt-4 bg-ethereal-bg-2 text-white hover:bg-white/20 border border-ethereal-border">
          Begin
        </Button>
      </GuardedLink>
    </div>
  )
}
