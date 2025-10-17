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



  return (
    <div className="container mx-auto p-4 md:p-6 h-full flex flex-col">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">The Parts Garden</h1>
        <p className="text-muted-foreground mt-2">
          Explore the parts of your inner world and select a card to see its details.
        </p>
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
