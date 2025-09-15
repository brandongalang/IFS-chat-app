import { NextRequest } from 'next/server'
import { resolveUserId } from '@/config/dev'
import { withSupabaseOrDev } from '@/lib/api/supabaseGuard'

export async function POST(req: NextRequest) {
  try {
    // Body is ignored for user identity; server derives user on its own
    await req.json().catch(() => ({} as Record<string, unknown>))

    return withSupabaseOrDev(req, async (ctx) => {
      if (ctx.type === 'no-supabase') {
        const devSessionId = `dev-${Math.random().toString(36).slice(2)}`
        return new Response(JSON.stringify({ sessionId: devSessionId }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (ctx.type === 'authed') {
        const { chatSessionService } = await import('../../../../lib/session-service')
        const sessionId = await chatSessionService.startSession(ctx.userId)
        return new Response(JSON.stringify({ sessionId }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (ctx.type === 'admin') {
        const personaUserId = resolveUserId()
        const nowIso = new Date().toISOString()
        const sessionRow = {
          user_id: personaUserId,
          start_time: nowIso,
          messages: [] as unknown[],
          parts_involved: {} as Record<string, unknown>,
          new_parts: [] as string[],
          breakthroughs: [] as string[],
          emotional_arc: {
            start: { valence: 0, arousal: 0 },
            peak: { valence: 0, arousal: 0 },
            end: { valence: 0, arousal: 0 },
          },
          processed: false,
          created_at: nowIso,
          updated_at: nowIso,
        }

        const { data, error } = await ctx.admin
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

      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    })
  } catch (error) {
    console.error('Session start API error:', error)
    return new Response(JSON.stringify({ error: 'Failed to start session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
