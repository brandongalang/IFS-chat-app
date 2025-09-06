'use client'

import { GuardedLink } from '@/components/common/GuardedLink'
import PersonaSwitcher from '@/components/dev/PersonaSwitcher'
import { showDevToggle } from '@/config/features'
import { CheckInCard } from '@/components/home/CheckInCard'

export default function HomePage() {

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="px-4 pt-6 pb-2 max-w-md w-full mx-auto" style={{ letterSpacing: 'var(--eth-letter-spacing-user)' }}>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>09:57</span>
          <span className="font-medium" style={{ color: 'rgba(255,255,255,var(--eth-user-opacity))' }}>good evening.</span>
          <GuardedLink href="/profile" aria-label="profile" className="size-6 rounded-full bg-muted" />
        </div>
        <div className="mt-2 flex items-center gap-2">
          {showDevToggle && (
            <button
              type="button"
              className="text-xs underline text-muted-foreground"
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
          <CheckInCard />

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
    </div>
  )
}
