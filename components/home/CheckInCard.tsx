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
        <div className="col-span-2 rounded-xl border border-white/15 bg-white/10 backdrop-blur-xl p-4">
            <div className="text-base font-medium text-white/90">Come back later</div>
            <div className="text-xs text-white/60 mt-1">Check-ins are available in the morning and evening.</div>
        </div>
    )
  }

  const isMorning = timeOfDay === 'morning'

  return (
    <div className="col-span-2 rounded-xl border border-white/15 bg-white/10 backdrop-blur-xl p-4">
      <div className="text-xs text-white/60">{isMorning ? 'Morning' : 'Evening'}</div>
      <div className="text-lg font-semibold text-white/90">{isMorning ? 'Fresh start!' : 'Daily review'}</div>
      <GuardedLink href="/check-in">
        <Button className="mt-4 bg-white/20 text-white hover:bg-white/30">
          Begin
        </Button>
      </GuardedLink>
    </div>
  )
}
