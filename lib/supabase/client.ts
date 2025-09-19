import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseKey, getSupabaseUrl } from './config'
import { createNoopSupabaseClient, isSupabaseConfigured } from './noop-client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

let browserClientOverride: unknown | null = null

export function setBrowserClientOverrideForTests(client: unknown | null): void {
  if (process.env.NODE_ENV === 'test') {
    browserClientOverride = client ?? null
  }
}

export function createClient() {
  if (process.env.NODE_ENV === 'test' && browserClientOverride) {
    return browserClientOverride as SupabaseClient<Database>
  }

  if (!isSupabaseConfigured()) {
    return createNoopSupabaseClient()
  }

  const url = getSupabaseUrl()
  const key = getSupabaseKey()

  if (!url || !key) {
    return createNoopSupabaseClient()
  }

  return createBrowserClient(url, key)
}
