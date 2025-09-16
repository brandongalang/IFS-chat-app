import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createNoopSupabaseClient, isSupabaseConfigured } from './noop-client'
import { getSupabaseServiceRoleKey, getSupabaseUrl } from './config'

let adminClientOverride: unknown | null = null

export function setAdminClientOverrideForTests(client: unknown | null): void {
  if (process.env.NODE_ENV === 'test') {
    adminClientOverride = client ?? null
  }
}

export function createAdminClient() {
  if (process.env.NODE_ENV === 'test' && adminClientOverride) {
    return adminClientOverride as ReturnType<typeof createSupabaseClient>
  }
  if (!isSupabaseConfigured()) {
    return createNoopSupabaseClient()
  }
  const url = getSupabaseUrl()
  const serviceKey = getSupabaseServiceRoleKey()
  if (!url || !serviceKey) {
    return createNoopSupabaseClient()
  }
  return createSupabaseClient(url, serviceKey)
}

