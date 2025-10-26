"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { GuardedLink } from '@/components/common/GuardedLink'
import * as React from 'react'
import { cn } from '@/lib/utils'

export function BottomTabs() {
  const pathname = usePathname() || '/'

  const tabs = React.useMemo(
    () => [
      { href: '/', label: 'Home', icon: 'home', type: 'link' as const },
      { href: '/insights', label: 'Journal', icon: 'edit_note', type: 'link' as const },
      { href: '/garden', label: 'Parts Map', icon: 'hub', type: 'guarded' as const },
      { href: '/chat', label: 'Guide', icon: 'school', type: 'link' as const },
    ],
    []
  )

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70"
      role="navigation"
      aria-label="Primary tabs"
    >
      <div className="mx-auto w-full max-w-3xl pb-safe">
        <div className="grid grid-cols-4 gap-1 px-3 pb-2 pt-3 text-xs font-medium text-muted-foreground">
          {tabs.map((tab) => {
            const active = isActive(tab.href)
            const content = (
              <div
                className={cn(
                  'flex h-full flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition',
                  active
                    ? 'bg-primary/15 text-foreground shadow-sm shadow-primary/10'
                    : 'hover:bg-card/60',
                )}
              >
                <span
                  className={cn(
                    'material-symbols-outlined text-2xl',
                    active ? 'text-trailhead-primary' : 'text-muted-foreground',
                  )}
                  style={{ fontVariationSettings: `'FILL' ${active ? 1 : 0}, 'wght' ${active ? 500 : 300}, 'GRAD' 0, 'opsz' 48` }}
                  aria-hidden
                >
                  {tab.icon}
                </span>
                <span className={cn('text-[0.7rem]', active ? 'text-foreground' : 'text-muted-foreground')}>{tab.label}</span>
              </div>
            )

            if (tab.type === 'guarded') {
              return (
                <GuardedLink
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={tab.label}
                  className="block h-full"
                >
                  {content}
                </GuardedLink>
              )
            }

            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                aria-label={tab.label}
                className="block h-full"
              >
                {content}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
