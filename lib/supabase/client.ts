import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseKey, getSupabaseUrl } from './config'

export function createClient() {
  const url = getSupabaseUrl()!
  const key = getSupabaseKey()!

  return createBrowserClient(url, key)
}
