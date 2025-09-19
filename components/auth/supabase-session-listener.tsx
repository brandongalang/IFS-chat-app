'use client'

import { useEffect } from 'react'

import { createClient } from '@/lib/supabase/client'

export function SupabaseSessionListener() {
  useEffect(() => {
    const supabase = createClient()

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          await fetch('/auth/callback', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ event, session }),
          })
        } catch (error) {
          console.error('Failed to sync auth session', error)
        }
      }
    )

    return () => {
      subscription?.subscription.unsubscribe()
    }
  }, [])

  return null
}
