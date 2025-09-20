'use client'

import { useState } from 'react'
import { GuardedLink } from '@/components/common/GuardedLink'
import PersonaSwitcher from '@/components/dev/PersonaSwitcher'
import { showDevToggle } from '@/config/features'
import { CheckInCard } from '@/components/home/CheckInCard'
import { WeekSelector } from '@/components/home/WeekSelector'
import { InboxShelf } from '@/components/inbox'
import { useUser } from '@/context/UserContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User as UserIcon } from 'lucide-react'

export default function HomePage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const { profile } = useUser()
  const trimmedName = profile?.name?.trim()
  const avatarAlt = trimmedName ? `${trimmedName}'s avatar` : 'User avatar'
  const userInitial =
    trimmedName?.match(/\p{L}|\p{N}/u)?.[0]?.toUpperCase() ?? null
  
  // Get current time for greeting
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'good morning.' : hour < 17 ? 'good afternoon.' : 'good evening.'

  return (
    <div
      className="min-h-screen text-foreground flex flex-col"
      style={{
        color: 'rgba(255,255,255,var(--eth-user-opacity))',
        letterSpacing: 'var(--eth-letter-spacing-user)',
      }}
    >
      {/* Header */}
      <header className="px-4 pt-6 pb-2 max-w-md w-full mx-auto">
        <div
          className="flex items-center justify-between text-sm"
          style={{ color: 'rgba(255,255,255,calc(var(--eth-user-opacity)*0.75))' }}
        >
          <span className="font-medium" style={{ color: 'rgba(255,255,255,var(--eth-user-opacity))' }}>{greeting}</span>
          <GuardedLink
            href="/profile"
            aria-label="Open profile"
            title={trimmedName || 'Profile'}
            className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border/40 bg-card/20 backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Avatar className="h-full w-full bg-card/40">
              {profile?.avatarUrl ? (
                <AvatarImage src={profile.avatarUrl} alt={avatarAlt} decoding="async" />
              ) : null}
              <AvatarFallback
                aria-hidden="true"
                className="flex items-center justify-center bg-transparent text-[10px] font-medium uppercase text-foreground/70"
              >
                {userInitial ?? <UserIcon aria-hidden="true" className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
          </GuardedLink>
        </div>
        <div className="mt-2 flex items-center gap-2">
          {showDevToggle && (
            <button
              type="button"
              className="text-xs underline"
              style={{ color: 'rgba(255,255,255,calc(var(--eth-user-opacity)*0.7))' }}
              onClick={() => {
                try {
                  localStorage.setItem('IFS_DEV_MODE', 'true')
                } catch {}
                location.reload()
              }}
            >
              Enable Dev Mode
            </button>
          )}
          <div className="ml-auto">
            <PersonaSwitcher />
          </div>
        </div>
      </header>

      {/* Week Selector with Streak System */}
      <div className="max-w-md w-full mx-auto px-4 mt-2">
        <WeekSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
      </div>

      {/* Action cards */}
      <main className="flex-1 px-4 py-6 flex items-start justify-center">
        <div className="w-full max-w-md grid grid-cols-2 gap-3">
          <CheckInCard selectedDate={selectedDate} />

          <InboxShelf />
        </div>
      </main>
    </div>
  )
}
