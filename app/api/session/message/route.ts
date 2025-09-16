import { NextRequest } from 'next/server'
import { withSupabaseOrDev } from '@/lib/api/supabaseGuard'
import { jsonResponse, errorResponse } from '@/lib/api/response'
import { resolveUserId } from '@/config/dev'

export async function POST(req: NextRequest) {
  try {
    const { sessionId, role, content } = await req.json()

    if (!sessionId || (role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
      return errorResponse('Invalid payload', 400)
    }

    return withSupabaseOrDev(req, async (ctx) => {
      if (ctx.type === 'no-supabase') {
        return jsonResponse({ ok: true, stored: false })
      }

      const { createChatSessionService } = await import('@/lib/session-service')

      if (ctx.type === 'authed') {
        const sessionService = createChatSessionService({ supabaseClient: ctx.supabase })
        await sessionService.addMessage(sessionId, { role, content })
        return jsonResponse({ ok: true, stored: true })
      }

      if (ctx.type === 'admin') {
        const personaUserId = resolveUserId()
        const sessionService = createChatSessionService({
          supabaseClient: ctx.admin,
          defaultUserId: personaUserId,
        })
        await sessionService.addMessage(sessionId, { role, content })
        return jsonResponse({ ok: true, stored: true })
      }

      return errorResponse('Unauthorized', 401)
    })
  } catch (error) {
    console.error('Session message API error:', error)
    return errorResponse('Failed to store message', 500)
  }
}
