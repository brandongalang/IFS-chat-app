import { NextRequest } from 'next/server'
import { resolveUserId } from '@/config/dev'
import { withSupabaseOrDev } from '@/lib/api/supabaseGuard'
import { jsonResponse, errorResponse } from '@/lib/api/response'

export async function POST(req: NextRequest) {
  try {
    // Body is ignored for user identity; server derives user on its own
    await req.json().catch(() => ({} as Record<string, unknown>))

    return withSupabaseOrDev(req, async (ctx) => {
      if (ctx.type === 'no-supabase') {
        const devSessionId = `dev-${Math.random().toString(36).slice(2)}`
        return jsonResponse({ sessionId: devSessionId })
      }

      const { createChatSessionService } = await import('../../../../lib/session-service')

      if (ctx.type === 'authed') {
        const sessionService = createChatSessionService({
          accessToken: ctx.accessToken,
          userId: ctx.userId,
        })
        const sessionId = await sessionService.startSession()
        return jsonResponse({ sessionId })
      }

      if (ctx.type === 'admin') {
        const personaUserId = resolveUserId()
        const sessionService = createChatSessionService({
          supabase: ctx.admin,
          userId: personaUserId,
        })
        const sessionId = await sessionService.startSession()
        return jsonResponse({ sessionId })
      }

      return errorResponse('Unauthorized', 401)
    })
  } catch (error) {
    console.error('Session start API error:', error)
    return errorResponse('Failed to start session', 500)
  }
}
