import { NextRequest } from 'next/server'
import { withSupabaseOrDev } from '@/lib/api/supabaseGuard'
import { jsonResponse, errorResponse } from '@/lib/api/response'

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

      if (ctx.type === 'authed') {
        const { createChatSessionService } = await import('@/lib/session-service')
        const sessionService = createChatSessionService({
          accessToken: ctx.accessToken,
          userId: ctx.userId,
        })
        await sessionService.addMessage(sessionId, { role, content })
        return jsonResponse({ ok: true, stored: true })
      }

      if (ctx.type === 'admin') {
        const { data: row, error: fetchError } = await ctx.admin
          .from('sessions')
          .select('messages')
          .eq('id', sessionId)
          .single()

        if (fetchError) throw fetchError

        const messages = Array.isArray(row?.messages) ? row.messages : []
        const newMessage = { role, content, timestamp: new Date().toISOString() }
        const updatedMessages = [...messages, newMessage]

        const { error: updateError } = await ctx.admin
          .from('sessions')
          .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
          .eq('id', sessionId)

        if (updateError) throw updateError

        return jsonResponse({ ok: true, stored: true })
      }

      return errorResponse('Unauthorized', 401)
    })
  } catch (error) {
    console.error('Session message API error:', error)
    return errorResponse('Failed to store message', 500)
  }
}
