'use client'

import Link from 'next/link'
import type { PartRowV2 } from '@/lib/data/schema/types'
import type { PartCategory } from '@/lib/types/database'

interface PartsListProps {
  parts: PartRowV2[]
  isLoading?: boolean
}

export function PartsList({ parts, isLoading }: PartsListProps) {

  // Map categories to accent colors from mockup
  const getCategoryDotColor = (category: PartCategory): string => {
    switch (category) {
      case 'manager':
        return 'bg-accent-terracotta'
      case 'firefighter':
        return 'bg-accent-slate'
      case 'exile':
        return 'bg-accent-dusty-blue'
      default:
        return 'bg-accent-sage'
    }
  }

  if (isLoading) {
    return (
      <>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-xl bg-card-light dark:bg-card-dark p-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] animate-pulse"
          >
            <div className="size-3 rounded-full bg-gray-300 dark:bg-gray-600" />
            <div className="mt-auto space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          </div>
        ))}
      </>
    )
  }

  if (filteredParts.length === 0) {
    return (
      <div className="col-span-2 text-center py-12">
        <p className="text-text-secondary-light dark:text-text-secondary-dark">No parts found</p>
      </div>
    )
  }

  return (
    <>
      {filteredParts.map((part) => {
        const role = (part.data as { role?: string } | null)?.role ?? null
        const description = role || 'Part of your inner system'

        return (
          <Link
            key={part.id}
            href={`/garden/${part.id}`}
            className="flex flex-col gap-3 rounded-xl bg-card-light dark:bg-card-dark p-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="flex items-start">
              <div
                className={`size-3 rounded-full ${getCategoryDotColor(part.category)}`}
                aria-label={`${part.category} colored dot representing a ${part.category} part category.`}
              />
            </div>
            <div className="mt-auto">
              <p className="text-text-primary-light dark:text-text-primary-dark text-base font-semibold leading-normal">
                {part.name}
              </p>
              <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm font-normal leading-normal mt-1">
                {description}
              </p>
            </div>
          </Link>
        )
      })}
    </>
  )
}
