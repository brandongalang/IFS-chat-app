"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { EtherealChat } from "@/components/ethereal/EtherealChat"
import { MaterialIcon } from "@/components/ui/MaterialIcon"

export default function ChatPage() {
  const lockedHeight = useLockedViewportHeight()
  const containerStyle = useMemo(() => {
    if (typeof lockedHeight !== "number") return undefined
    return { minHeight: lockedHeight, height: lockedHeight }
  }, [lockedHeight])

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })

  return (
    <Suspense fallback={null}>
      <div
        className="font-sans min-h-screen h-screen relative overflow-hidden bg-[var(--hs-bg)] flex flex-col"
        style={containerStyle}
      >
        {/* Top App Bar - Headspace style */}
        <header className="flex items-center px-4 py-3 justify-between sticky top-0 z-10 bg-[var(--hs-bg)]/95 backdrop-blur-md border-b border-[var(--hs-border-subtle)]">
          <Link
            href="/"
            className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--hs-text-secondary)] hover:bg-[var(--hs-surface)] transition-colors"
            aria-label="Go back"
          >
            <MaterialIcon name="arrow_back" />
          </Link>

          <div className="flex-1 text-center">
            <h2 className="text-base font-semibold text-[var(--hs-text-primary)]">
              Journal
            </h2>
            <p className="text-xs text-[var(--hs-text-tertiary)]">
              {currentDate}
            </p>
          </div>

          <button
            className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--hs-text-secondary)] hover:bg-[var(--hs-surface)] transition-colors"
            aria-label="More options"
          >
            <MaterialIcon name="more_vert" />
          </button>
        </header>

        {/* Chat component - kept as-is for AI SDK compatibility */}
        <EtherealChat />
      </div>
    </Suspense>
  )
}

function useLockedViewportHeight() {
  const [lockedHeight, setLockedHeight] = useState<number>()

  useEffect(() => {
    if (typeof window === "undefined") return

    const viewport = window.visualViewport
    const getHeight = () => Math.round(viewport?.height ?? window.innerHeight)
    const getWidth = () => Math.round(viewport?.width ?? window.innerWidth)

    let lastWidth = getWidth()
    let maxHeight = getHeight()
    setLockedHeight(maxHeight)

    const handleViewportResize = () => {
      if (!viewport) return
      const nextHeight = getHeight()
      if (nextHeight > maxHeight) {
        maxHeight = nextHeight
        setLockedHeight(maxHeight)
      }
    }

    const handleWindowResize = () => {
      const nextWidth = getWidth()
      const widthDelta = Math.abs(nextWidth - lastWidth)
      lastWidth = nextWidth

      const nextHeight = getHeight()
      // Treat large width changes as orientation switches so the locked height adapts.
      const orientationChanged = widthDelta > 120

      if (orientationChanged) {
        maxHeight = nextHeight
        setLockedHeight(maxHeight)
        return
      }

      if (nextHeight > maxHeight) {
        maxHeight = nextHeight
        setLockedHeight(maxHeight)
      }
    }

    viewport?.addEventListener("resize", handleViewportResize)
    window.addEventListener("resize", handleWindowResize)

    return () => {
      viewport?.removeEventListener("resize", handleViewportResize)
      window.removeEventListener("resize", handleWindowResize)
    }
  }, [])

  return lockedHeight
}
