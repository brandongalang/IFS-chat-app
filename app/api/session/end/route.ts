import { NextRequest } from 'next/server'
import { withSupabaseOrDev } from '@/lib/api/supabaseGuard'
import { jsonResponse, errorResponse } from '@/lib/api/response'
import { resolveUserId } from '@/config/dev'
import { readJsonBody, isRecord } from '@/lib/api/request'

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req)
    if (!isRecord(body) || typeof body.sessionId !== 'string') {
      return errorResponse('sessionId is required', 400)
    }

    const sessionId = body.sessionId

    return withSupabaseOrDev(req, async (ctx) => {
      if (ctx.type === 'no-supabase') {
        return jsonResponse({ ok: true, ended: false })
      }

      const { createChatSessionService } = await import('@/lib/session-service')

      if (ctx.type === 'authed') {
        const sessionService = createChatSessionService({
          accessToken: ctx.accessToken,
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
