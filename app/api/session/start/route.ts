import { NextRequest } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dev, resolveUserId } from '@/config/dev'
import { getSupabaseKey, getSupabaseUrl } from '@/lib/supabase/config'

export async function POST(req: NextRequest) {
  try {
    // Body is ignored for user identity; server derives user on its own
    await req.json().catch(() => ({} as any))

    const supabaseUrl = getSupabaseUrl()
    const supabaseAnon = getSupabaseKey()
    const hasSupabase =
      typeof supabaseUrl === 'string' && /^https?:\/\//.test(supabaseUrl) &&
      typeof supabaseAnon === 'string' && supabaseAnon.length > 20

    if (!hasSupabase) {
      // Development fallback when Supabase env is not configured
      const devSessionId = `dev-${Math.random().toString(36).slice(2)}`
      return new Response(JSON.stringify({ sessionId: devSessionId }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Try authenticated path first
    const supabase = await createServerSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    const authedUserId = session?.user?.id

    if (authedUserId) {
      const { chatSessionService } = await import('../../../../lib/session-service')
      const sessionId = await chatSessionService.startSession(authedUserId)
      return new Response(JSON.stringify({ sessionId }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Unauthenticated: allow DB persistence in dev mode by using a seeded persona user via admin client
    if (dev.enabled) {
      const personaUserId = resolveUserId()
      const admin = createAdminClient()

      // Build a minimal session row mirroring ChatSessionService defaults
      const nowIso = new Date().toISOString()
      const sessionRow = {
        user_id: personaUserId,
        start_time: nowIso,
        messages: [] as any[],
        parts_involved: {} as Record<string, unknown>,
        new_parts: [] as string[],
        breakthroughs: [] as string[],
        emotional_arc: {
          start: { valence: 0, arousal: 0 },
          peak: { valence: 0, arousal: 0 },
          end: { valence: 0, arousal: 0 }
        },
        processed: false,
        created_at: nowIso,
        updated_at: nowIso,
      }

      const { data, error } = await admin
        .from('sessions')
        .insert(sessionRow)
        .select('id')
        .single()

      if (error) throw error

      return new Response(JSON.stringify({ sessionId: data.id }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Production (or dev disabled) and unauthenticated
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Session start API error:', error)
    return new Response(JSON.stringify({ error: 'Failed to start session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

