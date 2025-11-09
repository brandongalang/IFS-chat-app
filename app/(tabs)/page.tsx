'use client'

import { useState } from 'react'
import { GuardedLink } from '@/components/common/GuardedLink'
import { PageContainer } from '@/components/common/PageContainer'
import PersonaSwitcher from '@/components/dev/PersonaSwitcher'
import { showDevToggle, isInboxEnabled } from '@/config/features'
import { CheckInSlots } from '@/components/home/CheckInSlots'
import { WeekSelector } from '@/components/home/WeekSelector'
import { useUser } from '@/context/UserContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Inbox } from '@/components/inbox/Inbox'
import { User as UserIcon } from 'lucide-react'

export default function HomePage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const { profile } = useUser()
  const trimmedName = profile?.name?.trim()
  const avatarAlt = trimmedName ? `${trimmedName}'s avatar` : 'User avatar'
  const userInitial = trimmedName?.match(/\p{L}|\p{N}/u)?.[0]?.toUpperCase() ?? null

  const inboxEnabled = isInboxEnabled()

  // Get current time for greeting
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col">
      {/* Header */}
      <header className="pt-10 pb-4 px-4">
        <div className="flex items-center justify-between">
          <h1 className="text-[#333333] dark:text-white tracking-light text-[32px] font-bold leading-tight">
            {greeting}
          </h1>
          <GuardedLink
            href="/profile"
            aria-label="Open profile"
            title={trimmedName || 'Profile'}
            className="h-8 w-8 rounded-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Avatar className="h-full w-full">
              {profile?.avatarUrl ? (
                <AvatarImage src={profile.avatarUrl} alt={avatarAlt} decoding="async" />
              ) : null}
              <AvatarFallback
                aria-hidden="true"
                className="flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-[10px] font-medium uppercase text-gray-600 dark:text-gray-300"
              >
                {userInitial ?? <UserIcon aria-hidden="true" className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
          </GuardedLink>
        </div>
        {showDevToggle && (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              className="text-xs underline text-gray-600 dark:text-gray-400"
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

      <main className="flex flex-col gap-5 px-4 flex-1">
        {/* Week Calendar */}
        <div className="flex flex-col gap-4">
          <WeekSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
        </div>

        {/* Daily Journey Section */}
        <div className="flex flex-col gap-4 pt-4">
          <div className="flex flex-col gap-0 rounded-xl bg-white dark:bg-[#1C1C1E] p-4 shadow-subtle overflow-hidden">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide px-2 pb-3">
              DAILY JOURNEY
            </h3>
            <div className="flex flex-col">
              <CheckInSlots selectedDate={selectedDate} />
            </div>
          </div>
        </div>

        {/* Inbox Section */}
        {inboxEnabled && (
          <div className="flex flex-col gap-4 pt-4">
            <Inbox />
          </div>
        )}
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
          “So whatever you want to do, just do it… Making a damn fool of yourself is absolutely essential.”
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
