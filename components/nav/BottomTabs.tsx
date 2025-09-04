"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, CalendarDays, Lightbulb, Sprout, Map } from 'lucide-react'
import { GuardedLink } from '@/components/common/GuardedLink'
import * as React from 'react'

export function BottomTabs() {
  const pathname = usePathname() || '/'

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  const baseItem =
    'block w-full h-full min-h-[56px] py-3 flex flex-col items-center justify-center gap-1 text-xs'

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 pt-3 pb-2"
      role="navigation"
      aria-label="Primary tabs"
    >
      <div className="mx-auto max-w-md">
        <div className="grid grid-cols-4 text-center text-muted-foreground">
          {/* Today */}
          <Link
            href="/"
            className={
              baseItem + ' ' + (isActive('/') ? 'text-foreground' : 'text-muted-foreground')
            }
            aria-current={isActive('/') ? 'page' : undefined}
            aria-label="Today"
            data-testid="nav-today"
          >
            <CalendarDays className="w-5 h-5" />
            <span>Today</span>
          </Link>

          {/* Insights */}
          <GuardedLink
            href="/insights"
            className={
              baseItem + ' ' + (isActive('/insights') ? 'text-foreground' : 'text-muted-foreground')
            }
            aria-current={isActive('/insights') ? 'page' : undefined}
            aria-label="Insights"
            data-testid="nav-insights"
          >
            <Lightbulb className="w-5 h-5" />
            <span>Insights</span>
          </GuardedLink>

          {/* Garden */}
          <GuardedLink
            href="/garden"
            className={
              baseItem + ' ' + (isActive('/garden') ? 'text-foreground' : 'text-muted-foreground')
            }
            aria-current={isActive('/garden') ? 'page' : undefined}
            aria-label="Garden"
            data-testid="nav-garden"
          >
            <Sprout className="w-5 h-5" />
            <span>Garden</span>
          </GuardedLink>

          {/* Journey */}
          <GuardedLink
            href="/journey"
            className={
              baseItem + ' ' + (isActive('/journey') ? 'text-foreground' : 'text-muted-foreground')
            }
            aria-current={isActive('/journey') ? 'page' : undefined}
            aria-label="Journey"
            data-testid="nav-journey"
          >
            <Map className="w-5 h-5" />
            <span>Journey</span>
          </GuardedLink>
        </div>
      </div>

      {/* Floating + button */}
      <div className="absolute inset-x-0 -top-6 flex justify-center pointer-events-none">
        <Link href={process.env.NEXT_PUBLIC_IFS_ETHEREAL_CHAT === 'false' ? '/chat' : '/chat/ethereal'} aria-label="Start a new chat" className="pointer-events-auto">
          <div className="size-14 rounded-full bg-primary text-primary-foreground shadow-xl grid place-items-center">
            <Plus className="w-7 h-7" />
          </div>
        </Link>
      </div>
    </nav>
  )
}
