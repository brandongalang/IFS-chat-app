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
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col">
      {/* Top App Bar */}
      <header className="flex items-center bg-background-light dark:bg-background-dark p-4 pb-2 justify-between sticky top-0 z-10">
        <div className="flex size-12 shrink-0 items-center">
          {/* Placeholder for potential menu icon */}
        </div>
        <h1 className="text-text-primary-light dark:text-text-primary-dark text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">
          My Parts
        </h1>
        <div className="flex w-12 items-center justify-end">
          <button className="flex max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 w-10 bg-transparent text-text-primary-light dark:text-text-primary-dark">
            <MaterialIcon name="more_vert" className="text-2xl" />
          </button>
        </div>
      </header>

      {/* SearchBar */}
      <div className="px-4 py-3 bg-background-light dark:bg-background-dark">
        <label className="flex flex-col min-w-40 h-12 w-full">
          <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
            <div className="text-text-secondary-light dark:text-text-secondary-dark flex border-none bg-search-light dark:bg-search-dark items-center justify-center pl-4 rounded-l-lg border-r-0">
              <MaterialIcon name="search" className="text-2xl" />
            </div>
            <input
              type="search"
              className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-r-lg text-text-primary-light dark:text-text-primary-dark focus:outline-0 focus:ring-0 border-none bg-search-light dark:bg-search-dark h-full placeholder:text-text-secondary-light dark:placeholder:text-text-secondary-dark px-4 pl-2 text-base font-normal leading-normal"
              placeholder="Search parts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </label>
      </div>

      {/* ImageGrid (Parts Garden) */}
      <main className="grid grid-cols-2 gap-4 p-4 flex-1 pb-24">
        {error && (
          <div className="col-span-2 text-red-500 text-center p-6 rounded-lg border border-red-500/20 bg-red-500/5">
            <p>Could not load garden: {error}</p>
          </div>
        )}

        {!error && <PartsList parts={filteredParts} isLoading={isLoading} />}
      </main>

      {/* FAB */}
      <div className="fixed bottom-24 right-5 z-20">
        <Link
          href="/garden/new"
          className="flex size-14 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-text-primary-light dark:bg-primary text-background-light dark:text-background-dark shadow-lg hover:shadow-xl transition-shadow"
          aria-label="Add new part"
        >
          <MaterialIcon name="add" className="text-3xl" />
        </Link>
      </div>
    </div>
  )
}
