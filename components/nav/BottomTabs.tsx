"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { GuardedLink } from '@/components/common/GuardedLink'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import * as React from 'react'

export function BottomTabs() {
  const pathname = usePathname() || '/'

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  const navItems = [
    {
      href: '/',
      label: 'Today',
      icon: 'home',
      testId: 'nav-today',
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
      href: '/chat',
      label: 'Journal',
      icon: 'edit_note',
      testId: 'nav-journal',
      isGuarded: false,
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
