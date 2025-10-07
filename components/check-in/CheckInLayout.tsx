'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface CheckInLayoutProps {
  variant: 'morning' | 'evening'
  stepTitle: string
  stepDescription?: string
  progress: number
  streakDays?: number
  error?: string | null
  children: ReactNode
}

export function CheckInLayout({
  variant,
  stepTitle,
  stepDescription,
  progress,
  streakDays,
  error,
  children,
}: CheckInLayoutProps) {
  const heading = variant === 'morning' ? 'Morning check-in' : 'Evening reflection'
  const subheading =
    variant === 'morning'
      ? 'Ease into your day with a few gentle prompts.'
      : 'Unwind and notice what shifted today.'

  const streakLabel =
    typeof streakDays === 'number' && streakDays > 0
      ? `${streakDays}-day streak`
      : null

  const progressPercent = Math.max(0, Math.min(100, Math.round(progress * 100)))
  const visualWidth = Math.max(4, progressPercent)

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6 md:p-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
            <p className="text-sm text-muted-foreground">{subheading}</p>
          </div>
          {streakLabel ? <Badge variant="secondary">{streakLabel}</Badge> : null}
        </div>
        <div className="mb-4">
          <div className="text-sm font-medium text-muted-foreground">{stepTitle}</div>
          {stepDescription ? <p className="text-xs text-muted-foreground/80">{stepDescription}</p> : null}
          <div
            className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={`${stepTitle} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <div
              className={cn('h-full rounded-full bg-primary transition-all duration-300')}
              style={{ width: `${visualWidth}%` }}
              aria-hidden="true"
            />
          </div>
        </div>
        {error ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 shadow-sm backdrop-blur">
          {children}
        </div>
      </div>
    </div>
  )
}
