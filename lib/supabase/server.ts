import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!

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