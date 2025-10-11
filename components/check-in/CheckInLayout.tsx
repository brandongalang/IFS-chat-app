'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface CheckInLayoutProps {
  variant: 'morning' | 'evening'
  streakDays?: number
  error?: string | null
  children: ReactNode
}

export function CheckInLayout({
  variant,
  streakDays,
  error,
  children,
}: CheckInLayoutProps) {
  const heading = variant === 'morning' ? 'Morning check-in' : 'Evening reflection'
  const subheading =
    variant === 'morning'
      ? 'Take a moment to notice how you're arriving today.'
      : 'Reflect on your day with curiosity and care.'

  const streakLabel =
    typeof streakDays === 'number' && streakDays > 0
      ? `${streakDays}-day streak`
      : null

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6 md:p-10">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subheading}</p>
          </div>
          {streakLabel ? <Badge variant="secondary">{streakLabel}</Badge> : null}
        </div>
        {error ? (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="rounded-2xl border border-border/60 bg-card/40 p-8 shadow-sm backdrop-blur">
          {children}
        </div>
      </div>
    </div>
  )
}
