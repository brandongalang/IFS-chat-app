import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { getUserClient, setUserClientOverrideForTests } from './clients'

/**
 * @deprecated Prefer importing { getUserClient } from '@/lib/supabase/clients'.
 */
export function createClient(): SupabaseClient<Database> {
  return getUserClient()
}

export { setUserClientOverrideForTests }
