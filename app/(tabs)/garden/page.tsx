'use client'

import { useState, useEffect } from 'react'
import { searchPartsV2 } from '@/lib/data/parts-lite'
import type { PartRowV2 } from '@/lib/data/schema/types'
import { PartsList } from '@/components/garden/PartsList'

export default function GardenPage() {
  const [parts, setParts] = useState<PartRowV2[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isActive = true

    async function fetchPartsData() {
      try {
        const partsResult = await searchPartsV2({ limit: 50 })
        if (!isActive) return

        if (partsResult && Array.isArray(partsResult)) {
          setParts(partsResult)
          setError(null)
        } else {
          throw new Error('Failed to load parts.')
        }
      } catch (e) {
        if (!isActive) return
        const message = e instanceof Error ? e.message : 'Failed to load parts.'
        setError(message)
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    setIsLoading(true)
    fetchPartsData()

    return () => {
      isActive = false
    }
  }, [])



  const totalParts = parts.length
  const establishedCount = parts.filter(
    (p) => p.status === 'acknowledged' || p.status === 'active' || p.status === 'integrated'
  ).length
  const activeToday = parts.filter((p) => {
    if (!p.last_active) return false
    const hoursAgo = (Date.now() - new Date(p.last_active).getTime()) / (1000 * 60 * 60)
    return hoursAgo < 24
  }).length
  const avgConfidence = totalParts > 0 
    ? Math.round((parts.reduce((sum, p) => sum + p.confidence, 0) / totalParts) * 100)
    : 0

  return (
    <div className="container mx-auto p-4 md:p-6 h-full flex flex-col">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Your Inner Garden</h1>
        <p className="text-muted-foreground mt-2">
          {isLoading ? '—' : totalParts} parts discovered • {isLoading ? '—' : activeToday} active today
        </p>

        {/* Stats Banner */}
        {!isLoading && (
          <div
            className="mt-4 rounded-xl border border-border/40 bg-card/20 p-4 backdrop-blur grid grid-cols-3 gap-4"
            aria-live="polite"
          >
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground tracking-wide">
                Total Parts
              </p>
              <p className="text-2xl font-bold mt-1">{totalParts}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground tracking-wide">
                Established
              </p>
              <p className="text-2xl font-bold mt-1">{establishedCount}</p>
              <p className="text-xs text-muted-foreground/70">avg {avgConfidence}% sure</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground tracking-wide">
                Active Today
              </p>
              <p className="text-2xl font-bold mt-1">{activeToday}</p>
            </div>
          </div>
        )}
      </header>

      <main className="flex-grow">
        {error && (
          <div className="text-red-500 text-center p-4">
            <p>Could not load garden: {error}</p>
          </div>
        )}

        {!error && <PartsList parts={parts} isLoading={isLoading} />}
      </main>
    </div>
  )
}
