import { dev } from '@/config/dev'
import { createAdminClient } from './admin'
import { getSupabaseServiceRoleKey } from './config'
import { createClient as createBrowserClient } from './client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

export type SupabaseDatabaseClient = SupabaseClient<Database>

export function getBrowserSupabaseClient(): SupabaseDatabaseClient {
  return createBrowserClient()
}

let serverModulePromise: Promise<typeof import('./server')> | null = null

async function loadServerModule() {
  if (!serverModulePromise) {
    serverModulePromise = import('./server')
  }
  return serverModulePromise
}

export async function getServerSupabaseClient(options: { useServiceRole?: boolean } = {}): Promise<SupabaseDatabaseClient> {
  const serviceRoleKey = getSupabaseServiceRoleKey()
  const shouldUseServiceRole = options.useServiceRole ?? (dev.enabled && Boolean(serviceRoleKey))
  if (shouldUseServiceRole && serviceRoleKey) {
    return createAdminClient()
  }
  const { createClient: createServerClient } = await loadServerModule()
  return await createServerClient()
}

export async function getServiceRoleSupabaseClient(): Promise<SupabaseDatabaseClient> {
  const serviceRoleKey = getSupabaseServiceRoleKey()
  if (!serviceRoleKey) {
    throw new Error('Supabase service role key is not configured')
  }
  return createAdminClient()
}
