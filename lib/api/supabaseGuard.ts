import { NextRequest } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dev } from '@/config/dev'

export type SupabaseGuardContext =
  | { type: 'no-supabase' }
  | { type: 'authed'; supabase: Awaited<ReturnType<typeof createServerSupabase>>; userId: string }
  | { type: 'admin'; admin: ReturnType<typeof createAdminClient> }

export async function withSupabaseOrDev(
  req: NextRequest,
  handler: (ctx: SupabaseGuardContext) => Promise<Response>
): Promise<Response> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const hasSupabase =
      typeof supabaseUrl === 'string' && /^https?:\/\//.test(supabaseUrl) &&
      typeof supabaseAnon === 'string' && supabaseAnon.length > 20

    if (!hasSupabase) {
      return await handler({ type: 'no-supabase' })
    }

    const supabase = await createServerSupabase()
    const {
      data: { session }
    } = await supabase.auth.getSession()
    const authedUserId = session?.user?.id

    if (authedUserId) {
      return await handler({ type: 'authed', supabase, userId: authedUserId })
    }

    if (dev.enabled) {
      const admin = createAdminClient()
      return await handler({ type: 'admin', admin })
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

