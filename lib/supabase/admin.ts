import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  }
  return createSupabaseClient(url, serviceKey)
}

