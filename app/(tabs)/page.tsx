'use client'

import { useState } from 'react'
import { GuardedLink } from '@/components/common/GuardedLink'
import { PageContainer } from '@/components/common/PageContainer'
import PersonaSwitcher from '@/components/dev/PersonaSwitcher'
import { showDevToggle } from '@/config/features'
import { CheckInCard } from '@/components/home/CheckInCard'
import { WeekSelector } from '@/components/home/WeekSelector'

export default function HomePage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  
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
              aria-label="profile"
              className="size-6 rounded-full border border-border/40 bg-card/20 backdrop-blur"
            />
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
        <WeekSelector 
          selectedDate={selectedDate} 
          onDateChange={setSelectedDate}
        />
      </PageContainer>

      {/* Action cards */}
      <main className="flex-1 py-6">
        <PageContainer className="grid grid-cols-2 gap-3">
          <CheckInCard selectedDate={selectedDate} />

          {/* Daily meditations (spans 2 columns) */}
          <div className="col-span-2 rounded-xl border border-border/40 bg-card/20 backdrop-blur p-4 mt-2">
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
              <blockquote className="italic">“So whatever you want to do, just do it… Making a damn fool of yourself is absolutely essential.”</blockquote>
              <div
                className="text-xs mt-2"
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
        </PageContainer>
      </main>
    </div>
  )
}
