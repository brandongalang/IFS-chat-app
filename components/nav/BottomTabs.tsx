"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, MessageCircle, Map } from 'lucide-react'
import { GuardedLink } from '@/components/common/GuardedLink'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { isNewUIEnabled } from '@/config/features'
import * as React from 'react'

export function BottomTabs() {
  const pathname = usePathname() || '/'
  const newUI = isNewUIEnabled()

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  if (newUI) {
    // New UI with Material Symbols
    const navItems = [
      {
        href: '/',
        label: 'Today',
        icon: 'home',
        testId: 'nav-today',
        isGuarded: false,
      },
      {
        href: '/chat',
        label: 'Journal',
        icon: 'edit_note',
        testId: 'nav-journal',
        isGuarded: false,
      },
      {
        href: '/garden',
        label: 'Parts',
        icon: 'psychology',
        testId: 'nav-parts',
        isGuarded: true,
      },
      {
        href: '/settings',
        label: 'Settings',
        icon: 'settings',
        testId: 'nav-settings',
        isGuarded: false,
      },
    ]

    return (
      <nav
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200/50 dark:border-gray-700/50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md"
        role="navigation"
        aria-label="Primary navigation"
      >
        <div className="flex justify-around items-center h-20 pb-safe">
          {navItems.map((item) => {
            const active = isActive(item.href)
            const LinkComponent = item.isGuarded ? GuardedLink : Link

            return (
              <LinkComponent
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 ${
                  active
                    ? 'text-primary dark:text-primary'
                    : 'text-[#555555] dark:text-gray-400'
                }`}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                data-testid={item.testId}
              >
                <MaterialIcon
                  name={item.icon}
                  filled={active}
                  className="text-2xl"
                />
                <span className="text-xs font-medium">{item.label}</span>
              </LinkComponent>
            )
          })}
        </div>
      </nav>
    )
  }

  // Original UI with Lucide icons
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
            <Map className="w-6 h-6" />
            <span className="text-xs">Garden</span>
          </GuardedLink>
        </div>
      </div>
    </nav>
  )
}
