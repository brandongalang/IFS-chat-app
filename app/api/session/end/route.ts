import { NextRequest } from 'next/server'
import { withSupabaseOrDev } from '@/lib/api/supabaseGuard'
import { jsonResponse, errorResponse } from '@/lib/api/response'

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()

    if (!sessionId || typeof sessionId !== 'string') {
      return errorResponse('sessionId is required', 400)
    }

    return withSupabaseOrDev(req, async (ctx) => {
      if (ctx.type === 'no-supabase') {
        return jsonResponse({ ok: true, ended: false })
      }

      if (ctx.type === 'authed') {
        const { chatSessionService } = await import('@/lib/session-service')
        await chatSessionService.endSession(sessionId)
        return jsonResponse({ ok: true, ended: true })
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

        return jsonResponse({ ok: true, ended: true })
      }

      return errorResponse('Unauthorized', 401)
    })
  } catch (error) {
    console.error('Session end API error:', error)
    return errorResponse('Failed to end session', 500)
  }
}
