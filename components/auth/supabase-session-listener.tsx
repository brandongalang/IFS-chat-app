'use client'

import { useEffect } from 'react'

import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/client'

export function SupabaseSessionListener() {
  useEffect(() => {
    const supabase = createClient()

    const MAX_RETRIES = 3
    const BASE_DELAY_MS = 250

    const syncSession = async (
      event: AuthChangeEvent,
      session: Session | null,
    ) => {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
        try {
          const response = await fetch('/auth/callback', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ event, session }),
          })

          if (!response.ok) {
            throw new Error(`Session sync failed with status ${response.status}`)
          }

          return
        } catch (error) {
          if (attempt === MAX_RETRIES) {
            console.error('Failed to sync auth session after retries', error)
            return
          }

          const backoffMs = BASE_DELAY_MS * 2 ** (attempt - 1)
          await new Promise((resolve) => setTimeout(resolve, backoffMs))
        }
      }
    }

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      await syncSession(event, session)
    })

    return () => {
      subscription?.subscription.unsubscribe()
    }
  }, [])

  return null
}
