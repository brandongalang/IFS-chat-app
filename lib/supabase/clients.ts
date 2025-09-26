import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import {
  getSupabaseKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from './config'
import { createNoopSupabaseClient, isSupabaseConfigured } from './noop-client'

let userClientOverride: SupabaseClient<Database> | null = null
let serviceClientOverride: SupabaseClient<Database> | null = null

type CookieAdapter = {
  get(name: string): string | undefined
  set(name: string, value: string, options?: Record<string, unknown>): void
  remove(name: string, options?: Record<string, unknown>): void
}

function resolveCookieAdapter(): CookieAdapter {
  const cookieStore = cookies()

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

export function setUserClientOverrideForTests(client: SupabaseClient<Database> | null): void {
  if (process.env.NODE_ENV === 'test') {
    userClientOverride = client ?? null
  }
}

export function setServiceClientOverrideForTests(client: SupabaseClient<Database> | null): void {
  if (process.env.NODE_ENV === 'test') {
    serviceClientOverride = client ?? null
  }
}

export function getUserClient(adapter?: CookieAdapter): SupabaseClient<Database> {
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

export function getServiceClient(): SupabaseClient<Database> {
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
        // Ensure each invocation is scoped by caller; avoids leaking bearer tokens.
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  })
}

export type { CookieAdapter as UserClientCookieAdapter }
