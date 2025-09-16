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
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal })
    clearTimeout(timeout)
    return !!res
  } catch {
    return false
  }
}

export type SupabaseGuardContext =
  | { type: 'no-supabase' }
  | {
      type: 'authed'
      supabase: Awaited<ReturnType<typeof createServerSupabase>>
      userId: string
      accessToken: string
    }
  | { type: 'admin'; admin: ReturnType<typeof createAdminClient> }

export async function withSupabaseOrDev(
  _req: NextRequest,
  handler: (ctx: SupabaseGuardContext) => Promise<Response>,
): Promise<Response> {
  try {
    const supabaseUrl = getSupabaseUrl()
    const supabaseAnon = getSupabaseKey()
    const hasSupabase =
      typeof supabaseUrl === 'string' && /^https?:\/\//.test(supabaseUrl) &&
      typeof supabaseAnon === 'string' && (supabaseAnon?.length ?? 0) > 20

    if (env.ifsForceNoSupabase) {
      return handler({ type: 'no-supabase' })
    }

    if (!hasSupabase) {
      return handler({ type: 'no-supabase' })
    }

    const reachable = await isReachable(supabaseUrl)
    if (!reachable && dev.enabled) {
      return handler({ type: 'no-supabase' })
    }

    try {
      const supabase = await createServerSupabase()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const authedUserId = session?.user?.id
      const accessToken = session?.access_token
      if (authedUserId && typeof accessToken === 'string' && accessToken.length > 0) {
        return handler({ type: 'authed', supabase, userId: authedUserId, accessToken })
      }
    } catch (error) {
      console.error('Supabase guard: auth session check failed', error)
      if (dev.enabled) {
        return handler({ type: 'no-supabase' })
      }
    }

    if (dev.enabled) {
      if (await isReachable(supabaseUrl)) {
        const admin = createAdminClient()
        return handler({ type: 'admin', admin })
      }
      return handler({ type: 'no-supabase' })
    }

    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Supabase guard error:', error)
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
