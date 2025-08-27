"use client"

import * as React from 'react'
import type { FeatureKey } from '@/config/features'
import { ComingSoonDialog } from './ComingSoonDialog'

type ComingSoonContextValue = {
  isOpen: boolean
  featureKey?: FeatureKey
  openComingSoon: (featureKey?: FeatureKey) => void
  close: () => void
}

const ComingSoonContext = React.createContext<ComingSoonContextValue | undefined>(undefined)

export function ComingSoonProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [featureKey, setFeatureKey] = React.useState<FeatureKey | undefined>(undefined)

  const openComingSoon = React.useCallback((key?: FeatureKey) => {
    setFeatureKey(key)
    setIsOpen(true)
  }, [])

  const close = React.useCallback(() => {
    setIsOpen(false)
  }, [])

  const value = React.useMemo(
    () => ({ isOpen, featureKey, openComingSoon, close }),
    [isOpen, featureKey, openComingSoon, close]
  )

  return (
    <ComingSoonContext.Provider value={value}>
      {children}
      <ComingSoonDialog open={isOpen} onOpenChange={setIsOpen} featureName={featureKey} />
    </ComingSoonContext.Provider>
  )
}

export function useComingSoon(): ComingSoonContextValue {
  const ctx = React.useContext(ComingSoonContext)
  if (!ctx) {
    throw new Error('useComingSoon must be used within a ComingSoonProvider')
  }
  return ctx
}

