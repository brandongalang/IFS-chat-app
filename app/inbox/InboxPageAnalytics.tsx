'use client'

import { useEffect } from 'react'
import { track } from '@/lib/analytics'

export function InboxPageAnalytics() {
  useEffect(() => {
    track('inbox_page_viewed', {
      path: '/inbox',
      source: 'inbox_route',
    })
  }, [])

  return null
}
