import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createNoopSupabaseClient, isSupabaseConfigured } from './noop-client'

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return createNoopSupabaseClient()
  }
  return createSupabaseClient(url, serviceKey)
}

