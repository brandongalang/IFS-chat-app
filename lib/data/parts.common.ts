import 'server-only'

import { createServerClient } from '@supabase/ssr'

import type { Database } from '../types/database'
import { createClient as createBrowserSupabase } from '@/lib/supabase/client'
import { createAdminClient } from '@/lib/supabase/admin'
import { dev } from '@/config/dev'

export function getSupabaseClient() {
  // Browser: use the preconfigured Next.js helper so env is inlined at build time
  if (typeof window !== 'undefined') {
    return createBrowserSupabase()
  }

  // Server: read from Node env and optionally use service role in dev
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

  if (!url || !anonKey) {
    throw new Error(
      "Your project's URL and Key are required to create a Supabase client!\n\n" +
        'Missing NEXT_PUBLIC_SUPABASE_URL/VITE_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.\n' +
        'Check your .env and ensure the Mastra dev server is loading it (npm run dev:mastra -- --env .env).'
    )
  }

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (dev.enabled && serviceRole) {
    // Dev-only bypass with service role on server
    return createAdminClient()
  }

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  })
}

