'use client'

import { useEffect, useState } from 'react'

// Simple mobile detection using a CSS breakpoint
// Returns true when viewport width is below 768px (md)
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 768px)')

    const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)

    // Initialize and subscribe
    setIsMobile(mq.matches)
    mq.addEventListener?.('change', handleChange)
    // Safari fallback
    // @ts-ignore
    mq.addListener?.(handleChange)

    return () => {
      mq.removeEventListener?.('change', handleChange)
      // @ts-ignore
      mq.removeListener?.(handleChange)
    }
  }, [])

  return isMobile
}

