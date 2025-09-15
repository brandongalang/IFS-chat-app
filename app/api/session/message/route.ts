import { NextRequest } from 'next/server'
import { withSupabaseOrDev } from '@/lib/api/supabaseGuard'

export async function POST(req: NextRequest) {
  try {
    const { sessionId, role, content } = await req.json()

    if (!sessionId || (role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return withSupabaseOrDev(req, async (ctx) => {
      if (ctx.type === 'no-supabase') {
        return new Response(JSON.stringify({ ok: true, stored: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (ctx.type === 'authed') {
        const { chatSessionService } = await import('@/lib/session-service')
        await chatSessionService.addMessage(sessionId, { role, content })
        return new Response(JSON.stringify({ ok: true, stored: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
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

        return new Response(JSON.stringify({ ok: true, stored: true }), {
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
    console.error('Session message API error:', error)
    return new Response(JSON.stringify({ error: 'Failed to store message' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
