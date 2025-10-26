'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', icon: 'home', label: 'Home' },
  { href: '/journal', icon: 'edit_note', label: 'Journal' },
  { href: '/parts-map', icon: 'hub', label: 'Parts Map' },
  { href: '/learn', icon: 'school', label: 'Learn' },
]

export function BottomNavigation() {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-redesign-background-light/80 dark:bg-redesign-background-dark/80 backdrop-blur-sm z-10 border-t border-redesign-accent-light/30 dark:border-redesign-accent-dark/30">
      <div className="flex justify-around items-center h-full max-w-lg mx-auto px-4 pb-safe">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
                isActive
                  ? 'text-redesign-primary dark:text-redesign-accent-light'
                  : 'text-redesign-text-light/70 dark:text-redesign-text-dark/70 hover:text-redesign-primary dark:hover:text-redesign-accent-light'
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className={`text-xs ${isActive ? 'font-bold' : ''}`}>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
