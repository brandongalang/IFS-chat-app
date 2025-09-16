import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseKey, getSupabaseUrl } from './config'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

let serverClientOverride: unknown | null = null

export function setServerClientOverrideForTests(client: unknown | null): void {
  if (process.env.NODE_ENV === 'test') {
    serverClientOverride = client ?? null
  }
}

/**
 * If using Fluid compute: Don't put this client in a global variable. Always create a new client within each
 * function when using it.
 */
export async function createClient() {
  if (process.env.NODE_ENV === 'test' && serverClientOverride) {
    return serverClientOverride as ReturnType<typeof createServerClient>
  }
  const cookieStore = await cookies()

  const url = getSupabaseUrl()!
  const key = getSupabaseKey()!

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

export function createClientWithAccessToken(accessToken: string): SupabaseClient<Database> {
  const url = getSupabaseUrl()
  const key = getSupabaseKey()

  if (!url || !key) {
    throw new Error('Supabase URL and key must be configured to create a server client')
  }

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return []
      },
      setAll() {
        /* no-op: JWT auth handles session */
      },
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
}
