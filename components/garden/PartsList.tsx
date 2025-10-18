'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getPartById } from '@/lib/data/parts-lite'
import type { PartRowV2 } from '@/lib/data/schema/types'
import type { PartCategory } from '@/lib/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { getStatusStyle, getCategoryColor } from '@/lib/garden/status-styles'
import { getFreshness } from '@/lib/garden/freshness'

interface PartsListProps {
  parts: PartRowV2[]
  isLoading?: boolean
}

const CATEGORIES: PartCategory[] = ['manager', 'firefighter', 'exile', 'unknown']

export function PartsList({ parts, isLoading }: PartsListProps) {
  const [selectedCategories, setSelectedCategories] = useState<Set<PartCategory>>(
    new Set(CATEGORIES)
  )
  const router = useRouter()
  const prefetchedIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (isLoading) return
    const prefetched = prefetchedIdsRef.current
    const limit = 8
    const targets = parts.slice(0, limit)

    targets.forEach((part) => {
      const partId = part.id
      if (!partId || prefetched.has(partId)) return

      prefetched.add(partId)
      void (async () => {
        try {
          await Promise.all([
            router.prefetch(`/garden/${partId}`),
            getPartById({ partId }),
          ])
        } catch {
          prefetched.delete(partId)
        }
      })()
    })
  }, [isLoading, parts, router])

  const toggleCategory = useCallback((category: PartCategory) => {
    const newSelected = new Set(selectedCategories)
    if (newSelected.has(category)) {
      newSelected.delete(category)
    } else {
      newSelected.add(category)
    }
    setSelectedCategories(newSelected)
  }, [selectedCategories])

  const filteredParts = useMemo(() => {
    return parts
      .filter((part) => selectedCategories.has(part.category))
      .sort((a, b) => {
        const aTime = a.last_active ? new Date(a.last_active).getTime() : 0
        const bTime = b.last_active ? new Date(b.last_active).getTime() : 0
        return bTime - aTime
      })
  }, [parts, selectedCategories])

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border/40 bg-card/20 p-5 space-y-3 animate-pulse"
          >
            <Skeleton className="h-12 w-12 rounded" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((category) => (
          <Button
            key={category}
            variant={selectedCategories.has(category) ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleCategory(category)}
            className="capitalize"
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Parts Grid */}
      {filteredParts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No parts</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredParts.map((part) => {
            const emoji = (part.data as { emoji?: string } | null)?.emoji ?? '🤗'
            const role = (part.data as { role?: string } | null)?.role ?? null
            const statusStyle = getStatusStyle(part.status)
            const freshness = getFreshness(part.last_active)
            const categoryColor = getCategoryColor(part.category)

            return (
              <Link
                key={part.id}
                href={`/garden/${part.id}`}
                className={cn(
                  'group relative block rounded-lg border transition-all duration-200 backdrop-blur',
                  'hover:border-border/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                  statusStyle.background,
                  statusStyle.border
                )}
              >
                {/* Category Pill - Top Right */}
                <div className={cn(
                  'absolute top-3 right-3 px-2 py-1 rounded-md text-xs font-semibold border capitalize',
                  categoryColor
                )}>
                  {part.category}
                </div>

                {/* Card Content */}
                <div className="p-5 space-y-3">
                  {/* Emoji with Evidence Badge */}
                  <div className="relative inline-block">
                    <span className={cn('text-5xl', statusStyle.emojiOpacity)}>
                      {emoji}
                    </span>
                    {part.evidence_count > 0 && (
                      <div className="absolute -bottom-2 -right-2 bg-blue-500/80 rounded-full px-2 py-1 text-xs font-semibold text-white shadow-sm">
                        {part.evidence_count}
                      </div>
                    )}
                  </div>

                  {/* Part Name */}
                  <h3 className="text-lg font-semibold leading-tight">
                    {part.name}
                  </h3>

                  {/* Role/Purpose if available */}
                  {role && (
                    <p className={cn('text-sm italic line-clamp-2', statusStyle.accentColor)}>
                      "{role}"
                    </p>
                  )}

                  {/* Status Description */}
                  <p className={cn('text-sm font-medium', statusStyle.accentColor)}>
                    {statusStyle.description}
                  </p>

                  {/* Evidence + Freshness */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Built from {part.evidence_count} {part.evidence_count === 1 ? 'observation' : 'observations'}</p>
                    <div className="flex items-center gap-2">
                      <span className={freshness.color}>{freshness.emoji}</span>
                      <span>{freshness.label}</span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
