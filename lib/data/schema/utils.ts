import type { SupabaseDatabaseClient } from '@/lib/supabase/clients'

export interface PrdDataDependencies {
  client: SupabaseDatabaseClient
  userId: string
}

export function assertPrdDeps(deps: PrdDataDependencies): PrdDataDependencies {
  if (!deps?.client) {
    throw new Error('Supabase client is required')
  }
  if (
    !deps.userId ||
    !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(deps.userId)
  ) {
    throw new Error('valid UUID userId is required for PRD operations')
  }
  return deps
}
