import { NextRequest } from 'next/server'
import { withSupabaseOrDev } from '@/lib/api/supabaseGuard'
import { jsonResponse, errorResponse } from '@/lib/api/response'
import { resolveUserId } from '@/config/dev'

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

      const { createChatSessionService } = await import('@/lib/session-service')

      if (ctx.type === 'authed') {
        const sessionService = createChatSessionService({
          supabase: ctx.supabase,
          userId: ctx.userId,
        })
        await sessionService.endSession(sessionId)
        return jsonResponse({ ok: true, ended: true })
      }

      if (ctx.type === 'admin') {
        const personaUserId = resolveUserId()
        const sessionService = createChatSessionService({
          supabase: ctx.admin,
          userId: personaUserId,
        })
        await sessionService.endSession(sessionId)
        return jsonResponse({ ok: true, ended: true })
      }

      return errorResponse('Unauthorized', 401)
    })
  } catch (error) {
    console.error('Session end API error:', error)
    return errorResponse('Failed to end session', 500)
  }
}
