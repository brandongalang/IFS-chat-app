'use client'

import { GuardedLink } from '@/components/common/GuardedLink'
import PersonaSwitcher from '@/components/dev/PersonaSwitcher'
import { showDevToggle } from '@/config/features'
import { CheckInCard } from '@/components/home/CheckInCard'

export default function HomePage() {

  return (
    <div className="min-h-screen flex flex-col text-ethereal-text-user">
      {/* Header */}
      <header className="px-4 pt-6 pb-2 max-w-md w-full mx-auto" style={{ letterSpacing: 'var(--eth-letter-spacing-user)' }}>
        <div className="flex items-center justify-between text-sm">
          <span>09:57</span>
          <span className="font-medium text-ethereal-text-assistant">good evening.</span>
          <GuardedLink href="/profile" aria-label="profile" className="size-6 rounded-full bg-ethereal-bg-2 border border-ethereal-border" />
        </div>
        <div className="mt-2 flex items-center gap-2">
          {showDevToggle && (
            <button
              type="button"
              className="text-xs underline"
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
        <div className="grid grid-cols-7 gap-2 text-center text-xs">
          {Array.from({ length: 7 }).map((_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            const day = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dayOfMonth = date.getDate();
            return (
              <div key={i} className="flex flex-col gap-1">
                <span>{day}</span>
                <div className="rounded-md bg-ethereal-bg-2 py-1">{dayOfMonth}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action cards */}
      <main className="flex-1 px-4 py-6 flex items-start justify-center">
        <div className="w-full max-w-md grid grid-cols-2 gap-3">
          <CheckInCard />

          {/* Daily meditations (spans 2 columns) */}
          <div className="col-span-2 rounded-xl border border-ethereal-border bg-ethereal-bg-1 p-4 mt-2">
            <div className="text-xs font-semibold tracking-wide text-ethereal-text-assistant">DAILY MEDITATIONS</div>
            <div className="mt-3 text-sm">
              <blockquote className="italic">“So whatever you want to do, just do it… Making a damn fool of yourself is absolutely essential.”</blockquote>
              <div className="text-xs mt-2">— Gloria Steinem</div>
            </div>
            <div className="mt-3 text-xs opacity-70">Tap to explore more insights</div>
          </div>
        </div>
      </main>
    </div>
  )
}
