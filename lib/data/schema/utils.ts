import type { SupabaseClient } from '@supabase/supabase-js'
import type { SupabaseDatabaseClient } from '@/lib/supabase/clients'

export interface PrdDataDependencies {
  client: SupabaseDatabaseClient
  userId: string
}

export function assertPrdDeps(deps: PrdDataDependencies): PrdDataDependencies {
  if (!deps?.client) {
    throw new Error('Supabase client is required')
  }
  if (!deps.userId) {
    throw new Error('userId is required for PRD operations')
  }
  return deps
}

export function prdClient(client: SupabaseDatabaseClient): SupabaseClient<any> {
  return client as unknown as SupabaseClient<any>
}
