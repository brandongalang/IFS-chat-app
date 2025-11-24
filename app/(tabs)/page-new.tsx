'use client'

import { useState } from 'react'
import { GuardedLink } from '@/components/common/GuardedLink'
import PersonaSwitcher from '@/components/dev/PersonaSwitcher'
import { showDevToggle, isInboxEnabled } from '@/config/features'
import { CheckInCardsHeadspace } from '@/components/home/CheckInCardsHeadspace'
import { WeekCalendarHeadspace } from '@/components/home/WeekCalendarHeadspace'
import { useUser } from '@/context/UserContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Inbox } from '@/components/inbox/Inbox'
import { useDailyCheckIns } from '@/hooks/useDailyCheckIns'

export function HomePageNew() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const { profile } = useUser()
  const { streak } = useDailyCheckIns(selectedDate)

  const trimmedName = profile?.name?.trim()
  const firstName = trimmedName?.split(' ')[0] || ''
  const avatarAlt = trimmedName ? `${trimmedName}'s avatar` : 'User avatar'
  const userInitial = trimmedName?.match(/\p{L}|\p{N}/u)?.[0]?.toUpperCase() ?? null

  const inboxEnabled = isInboxEnabled()

  // Get current time for greeting
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateString = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div className="min-h-screen bg-[var(--hs-bg)] flex flex-col hs-animate-in">
      {/* Header */}
      <header className="pt-12 pb-6 px-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Date */}
            <p className="text-sm font-medium text-[var(--hs-text-secondary)] mb-1">
              {dateString}
            </p>

            {/* Greeting */}
            <h1 className="text-[28px] font-bold text-[var(--hs-text-primary)] leading-tight">
              {greeting}{firstName ? `, ${firstName}` : ''}
            </h1>

            {/* Streak indicator */}
            {streak > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--hs-warm-muted)]">
                <span className="text-lg">🔥</span>
                <span className="text-sm font-semibold text-[var(--hs-warm-dark)]">
                  {streak} day streak
                </span>
              </div>
            )}
          </div>

          {/* Avatar */}
          <GuardedLink
            href="/profile"
            aria-label="Open profile"
            title={trimmedName || 'Profile'}
            className="h-12 w-12 rounded-full overflow-hidden ring-2 ring-[var(--hs-border-subtle)] ring-offset-2 ring-offset-[var(--hs-bg)] focus-visible:outline-none focus-visible:ring-[var(--hs-primary)]"
          >
            <Avatar className="h-full w-full">
              {profile?.avatarUrl ? (
                <AvatarImage src={profile.avatarUrl} alt={avatarAlt} decoding="async" />
              ) : null}
              <AvatarFallback
                aria-hidden="true"
                className="flex items-center justify-center bg-[var(--hs-primary-muted)] text-base font-semibold text-[var(--hs-primary)]"
              >
                {userInitial ?? (
                  <span className="material-symbols-outlined text-xl">person</span>
                )}
              </AvatarFallback>
            </Avatar>
          </GuardedLink>
        </div>

        {/* Dev toggle */}
        {showDevToggle && (
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              className="text-xs underline text-[var(--hs-text-tertiary)] hover:text-[var(--hs-text-secondary)]"
              onClick={() => {
                try {
                  localStorage.setItem('IFS_DEV_MODE', 'true')
                } catch {}
                location.reload()
              }}
            >
              Enable Dev Mode
            </button>
            <div className="ml-auto">
              <PersonaSwitcher />
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 px-5 pb-8 flex flex-col gap-6">
        {/* Week Calendar */}
        <section>
          <WeekCalendarHeadspace
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
          />
        </section>

        {/* Daily Journey Section */}
        <section>
          <h2 className="hs-section-title mb-4 px-1">Your daily journey</h2>
          <CheckInCardsHeadspace selectedDate={selectedDate} />
        </section>

        {/* Inbox Section */}
        {inboxEnabled && (
          <section>
            <Inbox />
          </section>
        )}
      </main>
    </div>
  )
}
