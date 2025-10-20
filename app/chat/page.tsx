"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
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
