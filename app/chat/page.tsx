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
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })

  return (
    <Suspense fallback={null}>
      <div
        className="font-display min-h-screen h-screen relative overflow-hidden bg-background-light dark:bg-background-dark flex flex-col"
        style={containerStyle}
      >
        {/* Top App Bar */}
        <header className="flex items-center bg-background-light dark:bg-background-dark p-4 pb-2 justify-between sticky top-0 z-10 border-b border-gray-200/50 dark:border-gray-700/50">
          <div className="flex size-12 shrink-0 items-center justify-start">
            <Link
              href="/"
              className="text-text-primary-light dark:text-text-primary-dark"
              aria-label="Go back"
            >
              <MaterialIcon name="arrow_back_ios_new" />
            </Link>
          </div>
          <h2 className="text-text-primary-light dark:text-text-primary-dark text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">
            {currentDate}
          </h2>
          <div className="flex w-12 items-center justify-end">
            <button className="flex max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-12 bg-transparent text-text-primary-light dark:text-text-primary-dark gap-2 text-base font-bold leading-normal tracking-[0.015em] min-w-0 p-0">
              <MaterialIcon name="more_vert" />
            </button>
          </div>
        </header>

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
        setLockedHeight(nextHeight)
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
        setLockedHeight(nextHeight)
        return
      }

      if (nextHeight > maxHeight) {
        maxHeight = nextHeight
        setLockedHeight(nextHeight)
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
