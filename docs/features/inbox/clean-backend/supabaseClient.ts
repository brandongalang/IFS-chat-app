import { createClient } from '@supabase/supabase-js'

export function createSupabaseClient() {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase credentials for inbox edge function')
  }
  return createClient(url, serviceKey)
}
