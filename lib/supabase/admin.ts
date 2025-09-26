import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import {
  getServiceClient,
  setServiceClientOverrideForTests,
} from './clients'

export function setAdminClientOverrideForTests(client: SupabaseClient<Database> | null): void {
  setServiceClientOverrideForTests(client)
}

export function createAdminClient(): SupabaseClient<Database> {
  return getServiceClient()
}

