'use client'

import { useState } from 'react'
import { GuardedLink } from '@/components/common/GuardedLink'
import { PageContainer } from '@/components/common/PageContainer'
import PersonaSwitcher from '@/components/dev/PersonaSwitcher'
import { showDevToggle, isInboxEnabled, isNewUIEnabled } from '@/config/features'
import { CheckInSlots } from '@/components/home/CheckInSlots'
import { WeekSelector } from '@/components/home/WeekSelector'
import { useUser } from '@/context/UserContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Inbox } from '@/components/inbox/Inbox'
import { User as UserIcon } from 'lucide-react'
import { HomePageNew } from './page-new'

export default function HomePage() {
  const newUI = isNewUIEnabled()
  
  if (newUI) {
    return <HomePageNew />
  }

  // Original UI
  const [selectedDate, setSelectedDate] = useState(new Date())
  const { profile } = useUser()
  const trimmedName = profile?.name?.trim()
  const avatarAlt = trimmedName ? `${trimmedName}'s avatar` : 'User avatar'
  const userInitial = trimmedName?.match(/\p{L}|\p{N}/u)?.[0]?.toUpperCase() ?? null

  const inboxEnabled = isInboxEnabled()

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
      <header className="pt-6 pb-2">
        <PageContainer>
          <div
            className="flex items-center justify-between text-sm"
            style={{ color: 'rgba(255,255,255,calc(var(--eth-user-opacity)*0.75))' }}
          >
            <span className="font-medium" style={{ color: 'rgba(255,255,255,var(--eth-user-opacity))' }}>{greeting}</span>
            <GuardedLink
              href="/profile"
              aria-label="Open profile"
              title={trimmedName || 'Profile'}
              className="h-8 w-8 rounded-full border border-border/40 bg-card/20 backdrop-blur flex items-center justify-center overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
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
        </PageContainer>
      </header>

      {/* Week Selector with Streak System */}
      <PageContainer className="mt-2">
        <WeekSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
      </PageContainer>

      {/* Action cards */}
      <main className="flex-1 py-6">
        <PageContainer className="grid grid-cols-2 gap-3">
          <CheckInSlots selectedDate={selectedDate} />

          {inboxEnabled ? <Inbox /> : <DailyMeditationsCard />}
        </PageContainer>
      </main>
    </div>
  )
}

function DailyMeditationsCard() {
  return (
    <div className="col-span-2 mt-2 rounded-xl border border-border/40 bg-card/20 p-4 backdrop-blur">
      <div
        className="text-xs font-semibold"
        style={{
          color: 'rgba(255,255,255,calc(var(--eth-user-opacity)*0.75))',
          letterSpacing: 'var(--eth-letter-spacing-user)',
        }}
      >
        DAILY MEDITATIONS
      </div>
      <div className="mt-3 text-sm">
        <blockquote className="italic">
          "So whatever you want to do, just do it… Making a damn fool of yourself is absolutely essential."
        </blockquote>
        <div
          className="mt-2 text-xs"
          style={{ color: 'rgba(255,255,255,calc(var(--eth-user-opacity)*0.65))' }}
        >
          — Gloria Steinem
        </div>
      </div>
      <div
        className="mt-3 text-xs"
        style={{ color: 'rgba(255,255,255,calc(var(--eth-user-opacity)*0.65))' }}
      >
        Tap to explore more insights
      </div>
    </div>
  )
}
