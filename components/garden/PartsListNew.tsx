'use client'

import Link from 'next/link'
import type { PartRowV2 } from '@/lib/data/schema/types'
import type { PartCategory } from '@/lib/types/database'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface PartsListNewProps {
  parts: PartRowV2[]
  isLoading?: boolean
}

export function PartsListNew({ parts, isLoading }: PartsListNewProps) {
  // Map categories to accent colors and icons
  const getCategoryConfig = (category: PartCategory) => {
    switch (category) {
      case 'manager':
        return {
          color: 'bg-accent-terracotta',
          lightBg: 'bg-accent-terracotta/10',
          textColor: 'text-accent-terracotta',
          icon: 'shield',
          label: 'Manager'
        }
      case 'firefighter':
        return {
          color: 'bg-accent-slate',
          lightBg: 'bg-accent-slate/10',
          textColor: 'text-accent-slate',
          icon: 'local_fire_department',
          label: 'Firefighter'
        }
      case 'exile':
        return {
          color: 'bg-accent-dusty-blue',
          lightBg: 'bg-accent-dusty-blue/10',
          textColor: 'text-accent-dusty-blue',
          icon: 'favorite',
          label: 'Exile'
        }
      default:
        return {
          color: 'bg-accent-sage',
          lightBg: 'bg-accent-sage/10',
          textColor: 'text-accent-sage',
          icon: 'spa',
          label: 'Part'
        }
    }
  }

  if (isLoading) {
    return (
      <>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="hs-card p-4 animate-pulse"
          >
            <div className="w-10 h-10 rounded-xl bg-[var(--hs-surface)] mb-3" />
            <div className="space-y-2">
              <div className="h-4 bg-[var(--hs-surface)] rounded w-3/4" />
              <div className="h-3 bg-[var(--hs-surface)] rounded w-1/2" />
            </div>
          </div>
        ))}
      </>
    )
  }

  if (parts.length === 0) {
    return (
      <div className="col-span-2 hs-card p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-[var(--hs-surface)] flex items-center justify-center mb-4">
          <MaterialIcon name="psychology" className="text-3xl text-[var(--hs-text-tertiary)]" />
        </div>
        <p className="text-[var(--hs-text-secondary)] font-medium">No parts found</p>
        <p className="text-sm text-[var(--hs-text-tertiary)] mt-1">
          Start by adding a part to your garden
        </p>
      </div>
    )
  }

  return (
    <>
      {parts.map((part) => {
        const role = (part.data as { role?: string } | null)?.role ?? null
        const description = role || 'Part of your inner system'
        const config = getCategoryConfig(part.category)

        return (
          <Link
            key={part.id}
            href={`/garden/${part.id}`}
            className="hs-card-interactive p-4 flex flex-col"
          >
            {/* Category icon */}
            <div className={`w-10 h-10 rounded-xl ${config.lightBg} flex items-center justify-center mb-3`}>
              <MaterialIcon
                name={config.icon}
                className={`text-xl ${config.textColor}`}
              />
            </div>

            {/* Part info */}
            <div className="mt-auto">
              <p className="text-[var(--hs-text-primary)] text-base font-semibold leading-tight">
                {part.name || 'Unnamed Part'}
              </p>
              <p className="text-[var(--hs-text-secondary)] text-sm mt-1 line-clamp-2">
                {description}
              </p>
            </div>

            {/* Category badge */}
            <div className="mt-3 flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${config.color}`} />
              <span className="text-xs text-[var(--hs-text-tertiary)] capitalize">
                {config.label}
              </span>
            </div>
          </Link>
        )
      })}
    </>
  )
}
