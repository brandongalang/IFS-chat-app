'use client'

import Link from 'next/link'
import { Plus, CalendarDays, Lightbulb, Sprout, Map } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GuardedLink } from '@/components/common/GuardedLink'
import { useComingSoon } from '@/components/common/ComingSoonProvider'
import { showDevToggle } from '@/config/features'

export default function HomePage() {
  const { openComingSoon } = useComingSoon()

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="px-4 pt-6 pb-2 max-w-md w-full mx-auto">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>09:57</span>
          <span className="font-medium">good evening.</span>
          <GuardedLink href="/profile" aria-label="profile" className="size-6 rounded-full bg-muted" />
        </div>
        {showDevToggle && (
          <button
            type="button"
            className="mt-2 text-xs underline text-muted-foreground"
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
      </header>

      {/* Calendar strip */}
      <div className="max-w-md w-full mx-auto px-4 mt-2">
        <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => (
            <div key={d + i} className="flex flex-col gap-1">
              <span>{d}</span>
              <div className="rounded-md bg-muted py-1">27</div>
            </div>
          ))}
        </div>
      </div>

      {/* Action cards */}
      <main className="flex-1 px-4 py-6 flex items-start justify-center">
        <div className="w-full max-w-md grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-green-600 text-white p-4">
            <div className="text-xs opacity-90">Morning</div>
            <div className="text-lg font-semibold">Fresh start!</div>
            <Button className="mt-4 bg-white text-green-700 hover:bg-white/90" onClick={() => openComingSoon()}>
              Begin
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-muted p-4">
            <div className="text-xs text-muted-foreground">Evening</div>
            <div className="text-base font-medium">Daily review</div>
            <div className="text-xs text-muted-foreground mt-1">Available in 8h 2m</div>
          </div>

          {/* Daily meditations (spans 2 columns) */}
          <div className="col-span-2 rounded-xl border border-border bg-card p-4 mt-2">
            <div className="text-xs font-semibold text-muted-foreground tracking-wide">DAILY MEDITATIONS</div>
            <div className="mt-3 text-sm">
              <blockquote className="italic">“So whatever you want to do, just do it… Making a damn fool of yourself is absolutely essential.”</blockquote>
              <div className="text-xs text-muted-foreground mt-2">— Gloria Steinem</div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">Tap to explore more insights</div>
          </div>
        </div>
      </main>

      {/* Bottom nav with center + button */}
      <nav className="relative border-t border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto max-w-md">
          <div className="grid grid-cols-4 text-center text-xs py-3 text-muted-foreground">
            <button className="flex flex-col items-center gap-1 text-foreground">
              <CalendarDays className="w-5 h-5" />
              <span>Today</span>
            </button>
            <GuardedLink href="/insights" className="flex flex-col items-center gap-1" data-testid="nav-insights">
              <Lightbulb className="w-5 h-5" />
              <span>Insights</span>
            </GuardedLink>
            <GuardedLink href="/garden" className="flex flex-col items-center gap-1" data-testid="nav-garden">
              <Sprout className="w-5 h-5" />
              <span>Garden</span>
            </GuardedLink>
            <GuardedLink href="/journey" className="flex flex-col items-center gap-1" data-testid="nav-journey">
              <Map className="w-5 h-5" />
              <span>Journey</span>
            </GuardedLink>
          </div>
        </div>
        {/* Floating + button */}
        <div className="absolute inset-x-0 -top-6 flex justify-center">
          <Link href="/chat" aria-label="Start a new chat">
            <div className="size-14 rounded-full bg-primary text-primary-foreground shadow-xl grid place-items-center">
              <Plus className="w-7 h-7" />
            </div>
          </Link>
        </div>
      </nav>
    </div>
  )
}
