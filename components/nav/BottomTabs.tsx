"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, MessageCircle, Map } from 'lucide-react'
import { GuardedLink } from '@/components/common/GuardedLink'
import * as React from 'react'

export function BottomTabs() {
  const pathname = usePathname() || '/'

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  const baseItem =
    'block w-full h-full min-h-14 py-3 flex flex-col items-center justify-center gap-1 text-xs'

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 pt-3 pb-safe"
      role="navigation"
      aria-label="Primary tabs"
    >
      <div className="mx-auto max-w-md">
        <div className="grid grid-cols-3 text-center text-muted-foreground">
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
            <CalendarDays className="w-6 h-6" />
            <span className="text-xs">Today</span>
          </Link>

          {/* Chat */}
          <Link
            href="/chat"
            className={
              baseItem + ' ' + (isActive('/chat') ? 'text-foreground' : 'text-muted-foreground')
            }
            aria-current={isActive('/chat') ? 'page' : undefined}
            aria-label="Chat"
            data-testid="nav-chat"
          >
            <MessageCircle className="w-6 h-6" />
            <span className="text-xs">Chat</span>
          </Link>

          {/* Journey */}
          <GuardedLink
            href="/garden"
            className={
              baseItem + ' ' + (isActive('/garden') ? 'text-foreground' : 'text-muted-foreground')
            }
            aria-current={isActive('/garden') ? 'page' : undefined}
            aria-label="Journey"
            data-testid="nav-journey"
          >
            <Map className="w-6 h-6" />
            <span className="text-xs">Journey</span>
          </GuardedLink>
        </div>
      </div>
    </nav>
  )
}
