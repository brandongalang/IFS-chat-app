import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseKey, getSupabaseUrl } from './config'
import { createNoopSupabaseClient, isSupabaseConfigured } from './noop-client'

export function createClient() {
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
