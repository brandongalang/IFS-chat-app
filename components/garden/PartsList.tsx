'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getPartById } from '@/lib/data/parts-lite'
import type { PartRowV2 } from '@/lib/data/schema/types'
import type { PartCategory } from '@/lib/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PartsListProps {
  parts: PartRowV2[]
  isLoading?: boolean
}

const CATEGORIES: PartCategory[] = ['manager', 'firefighter', 'exile', 'unknown']

function getChargeColor(charge: string | null): string {
  switch (charge) {
    case 'positive':
      return 'border-l-green-500'
    case 'negative':
      return 'border-l-red-500'
    case 'neutral':
    default:
      return 'border-l-gray-400'
  }
}

function formatTimeAgo(date: string | null): string {
  if (!date) return 'Never'
  const now = new Date()
  const then = new Date(date)
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)

  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return then.toLocaleDateString()
}

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
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-lg border border-border/40 bg-card/20 animate-pulse"
          />
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

      {/* Parts List */}
      {filteredParts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No parts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredParts.map((part) => {
            const emoji =
              (part.data as { emoji?: string } | null)?.emoji ?? '🤗'
            const timeAgo = formatTimeAgo(part.last_active)
            const chargeColor = getChargeColor(part.charge)
            const showConfidence = part.confidence > 0

            return (
              <Link
                key={part.id}
                href={`/garden/${part.id}`}
                className={cn(
                  'group block rounded-lg border border-l-4 border-border/40 bg-card/20 p-4 backdrop-blur',
                  'transition-all duration-200 hover:bg-card/30 hover:-translate-y-0.5 hover:shadow-md',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                  chargeColor
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl flex-shrink-0">{emoji}</span>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate">
                      {part.name}
                    </h3>

                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="secondary" className="capitalize text-xs">
                        {part.category}
                      </Badge>
                      <Badge variant="secondary" className="capitalize text-xs">
                        {part.status}
                      </Badge>
                      {part.needs_attention && (
                        <Badge className="text-xs bg-yellow-600/80 hover:bg-yellow-600">
                          ⚠ Attention
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground mt-2">
                      Active {timeAgo}
                    </p>

                    {showConfidence && (
                      <div className="mt-2 h-1 bg-primary/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/70 transition-all"
                          style={{
                            width: `${Math.round(part.confidence * 100)}%`,
                          }}
                        />
                      </div>
                    )}
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
