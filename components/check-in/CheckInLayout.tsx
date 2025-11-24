'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { isNewUIEnabled } from '@/config/features'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

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
  const newUI = isNewUIEnabled()
  const heading = variant === 'morning' ? 'Morning check-in' : 'Evening reflection'
  const subheading =
    variant === 'morning'
      ? "Take a moment to notice how you're arriving today."
      : 'Reflect on your day with curiosity and care.'

  const streakLabel =
    typeof streakDays === 'number' && streakDays > 0
      ? `${streakDays}-day streak`
      : null

  if (newUI) {
    return (
      <div className="min-h-screen bg-[var(--hs-bg)] flex flex-col hs-animate-in">
        {/* Header */}
        <header className="flex items-center px-4 py-3 sticky top-0 z-10 bg-[var(--hs-bg)]/95 backdrop-blur-md border-b border-[var(--hs-border-subtle)]">
          <Link
            href="/"
            className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--hs-text-secondary)] hover:bg-[var(--hs-surface)] transition-colors"
            aria-label="Go back"
          >
            <MaterialIcon name="close" />
          </Link>
          <div className="flex-1 text-center">
            <h1 className="text-base font-semibold text-[var(--hs-text-primary)]">
              {heading}
            </h1>
          </div>
          <div className="w-10" />
        </header>

        {/* Content */}
        <main className="flex-1 px-5 py-6 max-w-lg mx-auto w-full">
          {/* Intro section */}
          <div className="mb-6 text-center">
            <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 ${
              variant === 'morning'
                ? 'bg-[var(--hs-morning-start)]'
                : 'bg-[var(--hs-evening-start)]'
            }`}>
              <MaterialIcon
                name={variant === 'morning' ? 'wb_sunny' : 'dark_mode'}
                className={`text-3xl ${
                  variant === 'morning'
                    ? 'text-[var(--hs-morning-accent)]'
                    : 'text-[var(--hs-evening-accent)]'
                }`}
              />
            </div>
            <p className="text-[var(--hs-text-secondary)]">{subheading}</p>
            {streakLabel && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--hs-warm-muted)]">
                <span className="text-sm">🔥</span>
                <span className="text-sm font-medium text-[var(--hs-warm-dark)]">
                  {streakLabel}
                </span>
              </div>
            )}
          </div>

          {/* Error alert */}
          {error ? (
            <div className="mb-6 rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 p-4">
              <div className="flex items-start gap-3">
                <MaterialIcon name="error" className="text-red-500 text-xl flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-700 dark:text-red-400">Something went wrong</p>
                  <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Form content */}
          <div className="hs-card p-5 md:p-6">
            {children}
          </div>
        </main>
      </div>
    )
  }

  // Original UI
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-4 md:p-6 lg:p-10">
      <div className="w-full max-w-lg">
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
        <div className="rounded-2xl border border-border/60 bg-card/40 p-4 shadow-sm backdrop-blur md:p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
