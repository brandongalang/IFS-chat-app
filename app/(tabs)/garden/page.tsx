'use client'

import { useState, useEffect } from 'react'
import { searchPartsV2 } from '@/lib/data/parts-lite'
import type { PartRowV2 } from '@/lib/data/schema/types'
import { PartsList } from '@/components/garden/PartsList'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import Link from 'next/link'

export default function GardenPage() {
  const [parts, setParts] = useState<PartRowV2[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

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

  const filteredParts = searchQuery
    ? parts.filter((part) =>
        part.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : parts

  return (
    <div className="min-h-screen bg-[var(--hs-bg)] flex flex-col hs-animate-in">
      {/* Header */}
      <header className="pt-12 pb-4 px-5">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-[28px] font-bold text-[var(--hs-text-primary)] leading-tight">
              My Parts
            </h1>
            <p className="text-sm text-[var(--hs-text-secondary)] mt-1">
              {parts.length} {parts.length === 1 ? 'part' : 'parts'} in your garden
            </p>
          </div>
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-5 pb-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <MaterialIcon
              name="search"
              className="text-xl text-[var(--hs-text-tertiary)]"
            />
          </div>
          <input
            type="search"
            className="hs-input pl-12 pr-4"
            placeholder="Search parts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Parts Grid */}
      <main className="flex-1 px-5 pb-24">
        {error && (
          <div className="hs-card p-6 text-center border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10">
            <MaterialIcon name="error" className="text-3xl text-red-500 mb-2" />
            <p className="text-sm text-red-600 dark:text-red-400">
              Could not load garden: {error}
            </p>
          </div>
        )}

        {!error && (
          <div className="grid grid-cols-2 gap-4">
            <PartsList parts={filteredParts} isLoading={isLoading} />
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-24 right-5 z-20">
        <Link
          href="/garden/new"
          className="flex items-center justify-center w-14 h-14 rounded-full bg-[var(--hs-primary)] text-white shadow-glow hover:bg-[var(--hs-primary-dark)] transition-all duration-200 hover:scale-105"
          aria-label="Add new part"
        >
          <MaterialIcon name="add" className="text-3xl" />
        </Link>
      </div>
    </div>
  )
}
