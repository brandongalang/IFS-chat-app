'use client'

import { useMemo, useState } from 'react'
import { GuardedLink } from '@/components/common/GuardedLink'
import PersonaSwitcher from '@/components/dev/PersonaSwitcher'
import { showDevToggle, isInboxEnabled } from '@/config/features'
import { CheckInSlots } from '@/components/home/CheckInSlots'
import { WeekSelector } from '@/components/home/WeekSelector'
import { useUser } from '@/context/UserContext'
import { Inbox } from '@/components/inbox/Inbox'

const MORNING_ART =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBQgk-056HaLZw1KwN5pwfd4wI8BtEzhcRsWy8Dpv5Fu_W4HIjmgqO2Y5FGkZaSELzRnLOds1Ku8ppVFnPjUnqNsZMtCBSN5g5KsRcg0uPh62Z69tt95vbMBHh8XIReVTYOXz-pBWgG2KLS_U4jf4RuYMqmvTUs1wmEg74VF7sJ0KRjGV_UsZcTSvG2I95uKnVz6sDqv3ZPbz0KQuwYPO5OUbOD2djOW5Gynbavqm0vGQtm5zQjxNFsuAtDBM9jb6NCZAJRS-xU6HCS'
const EVENING_ART =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCzfChBY7uFMTQQ2GhK1bqZCBVKbdx3r5jiIxicBnSQa9HwhF2FSy-smClLLMHMfsELwg2pEaXlDUsVpufynkrs6j6jrZaW1OFxHW3HSQWO9yhLxQYSIEghZML-YDhrckrFOR7M_kXbo3eKBqb5CJwrPw08amU5z49FbzsgbjJOTpzANf-2mp4NQssvr9FoilvTJXWSx97MNZ2tiOJAmnpvvjlGwM8-6T7B-zQ4eaBixj5fhk5oKQ_Sj2g8sg-Z0JeFZSHTbOo0itVo'

export default function HomePage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const { profile } = useUser()
  const inboxEnabled = isInboxEnabled()

  const greeting = useMemo(() => {
    const now = new Date()
    const hour = now.getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])

  return (
    <div className="relative flex min-h-screen flex-col">
      <TrailheadHeader name={profile?.name} />

      <main className="flex-1">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 pb-32 pt-6 sm:px-6 lg:px-8">
          <section className="rounded-3xl bg-card shadow-lg shadow-primary/5 ring-1 ring-border/50">
            <div className="flex flex-col gap-4 p-5 sm:p-6 lg:p-8">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{greeting}</p>
                  <h2 className="text-2xl font-semibold text-foreground">Today&apos;s rhythm</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {showDevToggle ? <DevModeButton /> : null}
                  <PersonaSwitcher />
                </div>
              </div>
              <WeekSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
            </div>
          </section>

          <section aria-labelledby="todays-checkins-heading" className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 id="todays-checkins-heading" className="text-2xl font-semibold text-foreground">
                  Today&apos;s Check-ins
                </h2>
                <p className="text-sm text-muted-foreground">Two gentle touchpoints to bookend your day.</p>
              </div>
            </div>
            <CheckInSlots
              selectedDate={selectedDate}
              art={{ morning: MORNING_ART, evening: EVENING_ART }}
            />
          </section>

          <section aria-labelledby="trailhead-inbox-heading">
            {inboxEnabled ? (
              <Inbox />
            ) : (
              <DailyMeditationsCard />
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

function TrailheadHeader({ name }: { name?: string | null }) {
  const firstName = useMemo(() => name?.split(' ')[0], [name])

  return (
    <header className="sticky top-0 z-20 border-b border-border/40 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-card shadow-inner shadow-primary/10 ring-1 ring-border/60">
          <span className="material-symbols-outlined text-3xl text-trailhead-primary">psychology</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-center text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Trailhead</p>
          <p className="mt-1 text-base font-medium text-foreground">
            {firstName ? `Welcome back, ${firstName}.` : 'Your inner landscape awaits.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <GuardedLink
            href="/settings"
            className="flex size-11 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-border/60 transition hover:ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            aria-label="Open settings"
          >
            <span className="material-symbols-outlined text-foreground">settings</span>
          </GuardedLink>
        </div>
      </div>
    </header>
  )
}

function DevModeButton() {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
      onClick={() => {
        try {
          localStorage.setItem('IFS_DEV_MODE', 'true')
        } catch {}
        location.reload()
      }}
    >
      <span className="material-symbols-outlined text-base">construction</span>
      Enable Dev Mode
    </button>
  )
}

function DailyMeditationsCard() {
  return (
    <div className="rounded-3xl bg-card shadow-lg shadow-primary/5 ring-1 ring-border/60">
      <div className="grid gap-5 p-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center">
        <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[url('https://images.unsplash.com/photo-1534791547706-77ba5f2f8733?auto=format&fit=crop&w=800&q=80')] bg-cover bg-center" aria-hidden />
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Daily meditations
          </div>
          <blockquote className="text-lg font-medium text-foreground">
            “So whatever you want to do, just do it… Making a damn fool of yourself is absolutely essential.”
          </blockquote>
          <p className="text-sm text-muted-foreground">— Gloria Steinem</p>
          <p className="text-sm text-muted-foreground">We&apos;ll surface a new spark of inspiration once the agent has fresh insights.</p>
        </div>
      </div>
    </div>
  )
}
