'use client'

import { useState } from 'react'
import { GuardedLink } from '@/components/common/GuardedLink'
import PersonaSwitcher from '@/components/dev/PersonaSwitcher'
import { showDevToggle, isInboxEnabled } from '@/config/features'
import { CheckInSlots } from '@/components/home/CheckInSlots'
import { WeekSelector } from '@/components/home/WeekSelector'
import { useUser } from '@/context/UserContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Inbox } from '@/components/inbox/Inbox'
import { User as UserIcon } from 'lucide-react'
import { BottomNavigation } from '@/components/common/BottomNavigation'

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
  const greeting = hour < 12 ? 'Good morning.' : hour < 17 ? 'Good afternoon.' : 'Good evening.'

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden pb-24 bg-redesign-background-light dark:bg-redesign-background-dark font-redesign-display text-redesign-text-light dark:text-redesign-text-dark">
      {/* Header */}
      <div className="flex items-center p-4 pb-2 justify-between sticky top-0 bg-redesign-background-light/80 dark:bg-redesign-background-dark/80 backdrop-blur-sm z-10">
        <div className="flex size-12 shrink-0 items-center justify-center">
          <span className="material-symbols-outlined text-redesign-text-light dark:text-redesign-text-dark" style={{ fontSize: 32, fontVariationSettings: "'wght' 300, 'opsz' 48" }}>
            psychology
          </span>
        </div>
        <h1 className="text-redesign-text-light dark:text-redesign-text-dark text-xl font-bold leading-tight tracking-tight flex-1 text-center">Trailhead</h1>
        <div className="flex w-12 items-center justify-end">
          <GuardedLink
            href="/settings"
            aria-label="Open settings"
            title="Settings"
            className="flex max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-12 bg-transparent text-redesign-text-light dark:text-redesign-text-dark gap-2 text-base font-bold leading-normal tracking-[0.015em] min-w-0 p-0"
          >
            <span className="material-symbols-outlined text-redesign-text-light dark:text-redesign-text-dark">settings</span>
          </GuardedLink>
        </div>
      </div>

      <div className="p-4">
        {/* Today's Check-ins */}
        <h2 className="text-redesign-text-light dark:text-redesign-text-dark text-2xl font-bold leading-tight tracking-tight px-4 pb-3 pt-5">Today's Check-ins</h2>

        {/* For this example, we'll just wrap the existing components and assume they will be styled later */}
        <div className="p-4 @container">
            <CheckInSlots selectedDate={selectedDate} />
        </div>

        <div className="p-4">
          {inboxEnabled ? <Inbox /> : <DailyMeditationsCard />}
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  )
}

function DailyMeditationsCard() {
  return (
    <div className="relative flex items-stretch justify-between gap-4 rounded-xl bg-redesign-card-light dark:bg-redesign-card-dark p-4 shadow-md transition-shadow duration-300 hover:shadow-lg">
      <div className="flex flex-col gap-2 flex-[2_2_0px] justify-center">
        <p className="text-redesign-text-light dark:text-redesign-text-dark text-base font-bold leading-tight">Your Trailhead Guide</p>
        <p className="text-redesign-primary dark:text-redesign-accent-dark text-sm font-normal leading-normal">I was just thinking about our last conversation...</p>
      </div>
      <div
        className="w-24 h-24 bg-center bg-no-repeat bg-cover rounded-lg flex-shrink-0"
        style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBMWuGB5bX3CW9Mp8FLzo8gRJjgDOeyajWBVHT8r8DnDBN3KYJOJHRcH8NE6CW7HnJNAkipwWCtQZJzQ8LunMdvKAKDd_YMrNM0W355RosjefhcpvsDy5_itrgcY-HbpgrIVyaKmB37CPTrms0A2SjMff10QcIscnGMIGJM0Ye8xNhRVwmzl5o5QG-hfNGHX6kBjgTcVPgPsLurY0d3GFZuHZyIwtemikBSj2WHn8jFN2XNv_Ot3mapO2A0_XhwIdCnAzreCzeGqCD7")' }}
      ></div>
    </div>
  )
}
