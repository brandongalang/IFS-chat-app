import { createClient as createSupabaseClient } from '@supabase/supabase-js'

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  }
  return createSupabaseClient(url, serviceKey)
}

