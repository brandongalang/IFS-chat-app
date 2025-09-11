import { NextRequest } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dev } from '@/config/dev'
import { getSupabaseKey, getSupabaseUrl } from '@/lib/supabase/config'
import { env } from '@/config/env'

async function isReachable(url?: string, timeoutMs = 800): Promise<boolean> {
  if (!url) return false
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)
    // We only need to detect network availability; a 404 is still "reachable".
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal })
    clearTimeout(t)
    return !!res
  } catch {
    return false
  }
}

export type SupabaseGuardContext =
  | { type: 'no-supabase' }
  | { type: 'authed'; supabase: Awaited<ReturnType<typeof createServerSupabase>>; userId: string }
  | { type: 'admin'; admin: ReturnType<typeof createAdminClient> }

export async function withSupabaseOrDev(
  _req: NextRequest,
  handler: (ctx: SupabaseGuardContext) => Promise<Response>
): Promise<Response> {
  try {
    const supabaseUrl = getSupabaseUrl()
    const supabaseAnon = getSupabaseKey()
    const hasSupabase =
      typeof supabaseUrl === 'string' && /^https?:\/\//.test(supabaseUrl) &&
      typeof supabaseAnon === 'string' && (supabaseAnon?.length ?? 0) > 20

    // Dev override: allow forcing offline sessions regardless of env presence
    if (env.ifsForceNoSupabase) {
      return await handler({ type: 'no-supabase' })
    }

    if (!hasSupabase) {
      return await handler({ type: 'no-supabase' })
    }

    // If Supabase looks configured but is not reachable (local not started),
    // gracefully fall back to offline sessions in dev.
    const reachable = await isReachable(supabaseUrl)
    if (!reachable && dev.enabled) {
      return await handler({ type: 'no-supabase' })
    }

    let authedUserId: string | undefined
    try {
      const supabase = await createServerSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      authedUserId = session?.user?.id
      if (authedUserId) {
        return await handler({ type: 'authed', supabase, userId: authedUserId })
      }
    } catch (e) {
      // Network or client init failure: treat as offline in dev
      console.error('Supabase guard: auth session check failed', e)
      if (dev.enabled) {
        return await handler({ type: 'no-supabase' })
      }
      // In non-dev, fall through to unauthorized
    }

    if (dev.enabled) {
      // Only create an admin client if the instance is reachable
      if (await isReachable(supabaseUrl)) {
        const admin = createAdminClient()
        return await handler({ type: 'admin', admin })
      }
      // If not reachable, prefer offline sessions over 500s
      return await handler({ type: 'no-supabase' })
    }

    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Supabase guard error:', error)
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
