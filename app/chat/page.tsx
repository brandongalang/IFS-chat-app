"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Inter } from "next/font/google"
import { EtherealChat } from "@/components/ethereal/EtherealChat"

const inter = Inter({ subsets: ["latin"], weight: ["100", "300", "400", "600"], variable: "--font-ethereal" })

export default function ChatPage() {
  const lockedHeight = useLockedViewportHeight()
  const containerStyle = useMemo(() => {
    if (typeof lockedHeight !== "number") return undefined
    return { minHeight: lockedHeight, height: lockedHeight }
  }, [lockedHeight])

  return (
    <Suspense fallback={null}>
      <div
        className={`${inter.variable} font-sans min-h-screen h-screen relative overflow-hidden`}
        style={containerStyle}
      >
        <Link
          href="/today"
          className="absolute left-3 top-3 z-10 inline-flex items-center rounded-md border border-border/40 bg-card/20 px-3 py-1.5 text-xs text-foreground/80 backdrop-blur transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          Home
        </Link>
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
