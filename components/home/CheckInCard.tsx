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
        <div className="mt-1 text-xs text-muted-foreground">Check-ins are available in the morning and evening.</div>
      </div>
    )
  }

  const isMorning = timeOfDay === 'morning'
  const palette = isMorning
    ? {
        card: 'border-primary/40 bg-primary/30 text-primary-foreground',
        label: 'text-primary-foreground/80',
      }
    : {
        card: 'border-primary/40 bg-accent/30 text-accent-foreground',
        label: 'text-accent-foreground/80',
      }

  return (
    <div className={`col-span-2 rounded-xl border p-4 ${palette.card}`}>
      <div className={`text-xs opacity-90 ${palette.label}`}>{isMorning ? 'Morning' : 'Evening'}</div>
      <div className="text-lg font-semibold">{isMorning ? 'Fresh start!' : 'Daily review'}</div>
      <GuardedLink href="/check-in">
        <Button className="mt-4 bg-card/60 text-foreground hover:bg-card/80 backdrop-blur">
          Begin
        </Button>
      </GuardedLink>
    </div>
  )
}
