import { NextRequest } from 'next/server'
import { withSupabaseOrDev } from '@/lib/api/supabaseGuard'
import { jsonResponse, errorResponse } from '@/lib/api/response'
import { resolveUserId } from '@/config/dev'
import { readJsonBody, isRecord } from '@/lib/api/request'

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req)
    if (!isRecord(body)) {
      return errorResponse('Invalid payload', 400)
    }

    const sessionId = body.sessionId
    const role = body.role
    const content = body.content

    if (
      typeof sessionId !== 'string' ||
      (role !== 'user' && role !== 'assistant') ||
      typeof content !== 'string'
    ) {
      return errorResponse('Invalid payload', 400)
    }

    return withSupabaseOrDev(req, async (ctx) => {
      if (ctx.type === 'no-supabase') {
        return jsonResponse({ ok: true, stored: false })
      }

      const { createChatSessionService } = await import('@/lib/session-service')

      if (ctx.type === 'authed') {
        const sessionService = createChatSessionService({
          accessToken: ctx.accessToken,
          userId: ctx.userId,
        })
        await sessionService.addMessage(sessionId, { role, content })
        return jsonResponse({ ok: true, stored: true })
      }

      if (ctx.type === 'admin') {
        const personaUserId = resolveUserId()
        const sessionService = createChatSessionService({
          supabase: ctx.admin,
          userId: personaUserId,
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
