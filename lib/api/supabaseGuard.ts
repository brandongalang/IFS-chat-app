import { NextRequest } from 'next/server'
import { getServiceClient, getUserClient } from '@/lib/supabase/clients'
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
      supabase: Awaited<ReturnType<typeof getUserClient>>
      userId: string
    }
  | { type: 'admin'; admin: ReturnType<typeof getServiceClient> }

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
      const supabase = await getUserClient()
      const [{
        data: { session },
        error: sessionError,
      }, {
        data: userData,
        error: userError,
      }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.auth.getUser(),
      ])

      if (sessionError) {
        console.error('Supabase guard: session retrieval failed', sessionError)
      }

      if (userError) {
        console.error('Supabase guard: user retrieval failed', userError)
      }

      const authedUserId = userData?.user?.id

      if (authedUserId) {
        if (session?.user?.id && session.user.id !== authedUserId) {
          console.warn('Supabase guard: session user mismatch', {
            sessionUserId: session.user.id,
            authenticatedUserId: authedUserId,
          })
        }
        return handler({ type: 'authed', supabase, userId: authedUserId })
      }
    } catch (error) {
      console.error('Supabase guard: auth session check failed', error)
      if (dev.enabled) {
        return handler({ type: 'no-supabase' })
      }
    }

    if (dev.enabled) {
      if (await isReachable(supabaseUrl)) {
        const admin = getServiceClient()
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
