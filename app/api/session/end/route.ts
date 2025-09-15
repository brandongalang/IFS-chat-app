import { NextRequest } from 'next/server'
import { withSupabaseOrDev } from '@/lib/api/supabaseGuard'

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()

    if (!sessionId || typeof sessionId !== 'string') {
      return new Response(JSON.stringify({ error: 'sessionId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return withSupabaseOrDev(req, async (ctx) => {
      if (ctx.type === 'no-supabase') {
        return new Response(JSON.stringify({ ok: true, ended: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (ctx.type === 'authed') {
        const { chatSessionService } = await import('@/lib/session-service')
        await chatSessionService.endSession(sessionId)
        return new Response(JSON.stringify({ ok: true, ended: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (ctx.type === 'admin') {
        const { data: row, error: fetchError } = await ctx.admin
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

        const { error: updateError } = await ctx.admin
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
    })
  } catch (error) {
    console.error('Session end API error:', error)
    return new Response(JSON.stringify({ error: 'Failed to end session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
