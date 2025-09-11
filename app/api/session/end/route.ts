import { NextRequest } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dev } from '@/config/dev'
import { getSupabaseKey, getSupabaseUrl } from '@/lib/supabase/config'

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()

    if (!sessionId || typeof sessionId !== 'string') {
      return new Response(JSON.stringify({ error: 'sessionId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = getSupabaseUrl()
    const supabaseAnon = getSupabaseKey()
    const hasSupabase =
      typeof supabaseUrl === 'string' && /^https?:\/\//.test(supabaseUrl) &&
      typeof supabaseAnon === 'string' && supabaseAnon.length > 20

    if (!hasSupabase) {
      // Dev fallback when Supabase env is not configured
      return new Response(JSON.stringify({ ok: true, ended: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Try authenticated path first (RLS-protected)
    const supabase = await createServerSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    const authedUserId = session?.user?.id

    if (authedUserId) {
      const { chatSessionService } = await import('@/lib/session-service')
      await chatSessionService.endSession(sessionId)
      return new Response(JSON.stringify({ ok: true, ended: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Dev mode unauthenticated: admin client updates session
    if (dev.enabled) {
      const admin = createAdminClient()

      // Fetch start_time to compute duration; if missing, set ended without duration
      const { data: row, error: fetchError } = await admin
        .from('sessions')
        .select('start_time')
        .eq('id', sessionId)
        .single()

      if (fetchError) throw fetchError

      const endTime = new Date().toISOString()
      let duration: number | null = null
      try {
        if (row?.start_time) {
          const startMs = new Date(row.start_time as unknown as string).getTime()
          const endMs = new Date(endTime).getTime()
          duration = Math.max(0, Math.floor((endMs - startMs) / 1000))
        }
      } catch {}

      const { error: updateError } = await admin
        .from('sessions')
        .update({ end_time: endTime, duration, updated_at: endTime })
        .eq('id', sessionId)

      if (updateError) throw updateError

      return new Response(JSON.stringify({ ok: true, ended: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Session end API error:', error)
    return new Response(JSON.stringify({ error: 'Failed to end session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

