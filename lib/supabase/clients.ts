import { cookies } from 'next/headers'
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

type SupabaseConfig = {
  url: string
  key: string
}

function resolveSupabaseConfig(keyType: 'anon' | 'service'): SupabaseConfig | null {
  const url = getSupabaseUrl()
  if (!url) return null

  if (keyType === 'anon') {
    const key = getSupabaseKey()
    return key ? { url, key } : null
  }

  const serviceKey = getSupabaseServiceRoleKey()
  return serviceKey ? { url, key: serviceKey } : null
}

export type SupabaseDatabaseClient = SupabaseClient<Database>

type CookieAdapter = {
  get(name: string): string | undefined
  set(name: string, value: string, options?: Record<string, unknown>): void
  remove(name: string, options?: Record<string, unknown>): void
}

let userClientOverride: SupabaseDatabaseClient | null = null
let serviceClientOverride: SupabaseDatabaseClient | null = null

async function resolveCookieAdapter(): Promise<CookieAdapter> {
  const cookieStore = await cookies()

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

export async function getUserClient(adapter?: CookieAdapter): Promise<SupabaseDatabaseClient> {
  if (process.env.NODE_ENV === 'test' && userClientOverride) {
    return userClientOverride
  }

  if (!isSupabaseConfigured()) {
    return createNoopSupabaseClient()
  }

  const config = resolveSupabaseConfig('anon')
  if (!config) {
    return createNoopSupabaseClient()
  }

  const cookieAdapter = adapter ?? await resolveCookieAdapter()
  const { url, key } = config

  return createServerClient<Database>(url, key, {
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

  const config = resolveSupabaseConfig('service')
  if (!config) {
    return createNoopSupabaseClient()
  }

  return createSupabaseClient<Database>(config.url, config.key, {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${config.key}`,
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
  const config = resolveSupabaseConfig('service')
  if (!config) {
    throw new Error('Supabase service role key is not configured')
  }
  return getServiceClient()
}

export type { CookieAdapter as UserClientCookieAdapter }
