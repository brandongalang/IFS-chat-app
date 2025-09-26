import { cookies, type UnsafeUnwrappedCookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { dev } from '@/config/dev'
import {
  getSupabaseKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from './config'
import { createClient as createBrowserClient } from './client'
import { createNoopSupabaseClient, isSupabaseConfigured } from './noop-client'

export type SupabaseDatabaseClient = SupabaseClient<Database>

type CookieAdapter = {
  get(name: string): string | undefined
  set(name: string, value: string, options?: Record<string, unknown>): void
  remove(name: string, options?: Record<string, unknown>): void
}

let userClientOverride: SupabaseDatabaseClient | null = null
let serviceClientOverride: SupabaseDatabaseClient | null = null

function resolveCookieAdapter(): CookieAdapter {
  const cookieStore = cookies() as unknown as UnsafeUnwrappedCookies

  return {
    get(name) {
      return cookieStore.get(name)?.value
    },
    set(name, value, options) {
      try {
        cookieStore.set({ name, value, ...(options ?? {}) })
      } catch {
        // Server Components cannot mutate cookies directly; middleware keeps sessions fresh.
      }
    },
    remove(name, options) {
      try {
        cookieStore.set({ name, value: '', ...(options ?? {}) })
      } catch {
        // Ignored — behavior matches .set handler above.
      }
    },
  }
}

export function setUserClientOverrideForTests(client: SupabaseDatabaseClient | null): void {
  if (process.env.NODE_ENV === 'test') {
    userClientOverride = client ?? null
  }
}

export function setServiceClientOverrideForTests(client: SupabaseDatabaseClient | null): void {
  if (process.env.NODE_ENV === 'test') {
    serviceClientOverride = client ?? null
  }
}

export function getUserClient(adapter?: CookieAdapter): SupabaseDatabaseClient {
  if (process.env.NODE_ENV === 'test' && userClientOverride) {
    return userClientOverride
  }

  if (!isSupabaseConfigured()) {
    return createNoopSupabaseClient()
  }

  const url = getSupabaseUrl()
  const anonKey = getSupabaseKey()

  if (!url || !anonKey) {
    return createNoopSupabaseClient()
  }

  const cookieAdapter = adapter ?? resolveCookieAdapter()

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      get: (name) => cookieAdapter.get(name),
      set: (name, value, options) => cookieAdapter.set(name, value, options),
      remove: (name, options) => cookieAdapter.remove(name, options),
    },
  })
}

export function getServiceClient(): SupabaseDatabaseClient {
  if (process.env.NODE_ENV === 'test' && serviceClientOverride) {
    return serviceClientOverride
  }

  if (!isSupabaseConfigured()) {
    return createNoopSupabaseClient()
  }

  const url = getSupabaseUrl()
  const serviceKey = getSupabaseServiceRoleKey()

  if (!url || !serviceKey) {
    return createNoopSupabaseClient()
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  })
}

export function getBrowserSupabaseClient(): SupabaseDatabaseClient {
  return createBrowserClient()
}

export async function getServerSupabaseClient(options: { useServiceRole?: boolean } = {}): Promise<SupabaseDatabaseClient> {
  const serviceRoleKey = getSupabaseServiceRoleKey()
  const shouldUseServiceRole = options.useServiceRole ?? (dev.enabled && Boolean(serviceRoleKey))

  if (shouldUseServiceRole && serviceRoleKey) {
    return getServiceClient()
  }

  return getUserClient()
}

export async function getServiceRoleSupabaseClient(): Promise<SupabaseDatabaseClient> {
  const serviceRoleKey = getSupabaseServiceRoleKey()
  if (!serviceRoleKey) {
    throw new Error('Supabase service role key is not configured')
  }
  return getServiceClient()
}

export type { CookieAdapter as UserClientCookieAdapter }
