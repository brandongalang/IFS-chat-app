'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getPartById } from '@/lib/data/parts-lite'
import type { PartRowV2 } from '@/lib/data/schema/types'
import type { PartCategory } from '@/lib/types/database'
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

const statusAccentMap = {
  emerging: 'border-l-amber-400',
  acknowledged: 'border-l-blue-400',
  active: 'border-l-emerald-400',
  integrated: 'border-l-purple-400',
} as const

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
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }, [])

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
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        role="status"
        aria-busy="true"
        aria-label="Loading parts"
      >
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
    <div className="space-y-6">
      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((category) => (
          <Button
            key={category}
            variant={selectedCategories.has(category) ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleCategory(category)}
            className="capitalize transition-all duration-150"
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
            const accentColor = statusAccentMap[part.status]

            return (
              <Link
                key={part.id}
                href={`/garden/${part.id}`}
                className={cn(
                  'group relative block rounded-lg border-l-4 transition-all duration-200 backdrop-blur',
                  'hover:shadow-lg hover:border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                  'hover:scale-105 origin-top-left',
                  statusStyle.background,
                  statusStyle.border,
                  accentColor
                )}
              >
                {/* Category Pill - Top Right */}
                <div className={cn(
                  'absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-semibold border capitalize shadow-sm',
                  categoryColor
                )}>
                  {part.category}
                </div>

                {/* Card Content */}
                <div className="p-5 space-y-3">
                  {/* Emoji with Evidence Badge */}
                  <div className="relative inline-block">
                    <span
                      className={cn('text-5xl transition-transform duration-200 group-hover:scale-110', statusStyle.emojiOpacity)}
                      role="img"
                      aria-label={`${part.name} emoji`}
                    >
                      {emoji}
                    </span>
                    {part.evidence_count > 0 && (
                      <div
                        className="absolute -bottom-2 -right-2 bg-blue-500/90 rounded-full px-2.5 py-1 text-xs font-bold text-white shadow-md border border-blue-400/50"
                        aria-label={`${part.evidence_count} evidence items`}
                      >
                        {part.evidence_count}
                      </div>
                    )}
                  </div>

                  {/* Part Name */}
                  <h3 className="text-lg font-semibold leading-tight text-foreground">
                    {part.name}
                  </h3>

                  {/* Role/Purpose if available */}
                  {role && (
                    <p className={cn('text-sm italic line-clamp-2 opacity-75', statusStyle.accentColor)}>
                      <span aria-hidden="true" className="opacity-50">&ldquo;</span>
                      {role}
                      <span aria-hidden="true" className="opacity-50">&rdquo;</span>
                    </p>
                  )}

                  {/* Status Description */}
                  <p className={cn('text-xs font-medium uppercase tracking-wide', statusStyle.accentColor)}>
                    {statusStyle.description}
                  </p>

                  {/* Evidence + Freshness */}
                  <div className="text-xs text-muted-foreground space-y-1 pt-1">
                    <p className="text-foreground/60">Built from {part.evidence_count} {part.evidence_count === 1 ? 'observation' : 'observations'}</p>
                    <div className="flex items-center gap-2">
                      <span aria-hidden="true">{freshness.emoji}</span>
                      <span className={freshness.color}>{freshness.label}</span>
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
