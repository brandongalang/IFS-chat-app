import { NextRequest } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dev } from '@/config/dev'
import { jsonResponse, errorResponse } from '@/lib/api/response'

export async function POST(req: NextRequest) {
  try {
    const { sessionId, role, content } = await req.json()

    if (!sessionId || (role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
      return errorResponse('Invalid payload', 400)
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const hasSupabase =
      typeof supabaseUrl === 'string' && /^https?:\/\//.test(supabaseUrl) &&
      typeof supabaseAnon === 'string' && supabaseAnon.length > 20

    if (!hasSupabase) {
      // Development fallback when Supabase env is not configured
      return jsonResponse({ ok: true, stored: false })
    }

    // Try authenticated user path first (RLS-protected)
    const supabase = await createServerSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    const authedUserId = session?.user?.id

    if (authedUserId) {
      const { chatSessionService } = await import('@/lib/session-service')
      await chatSessionService.addMessage(sessionId, { role, content })
      return jsonResponse({ ok: true, stored: true })
    }

    // Dev mode: use admin client to bypass RLS and append message for persona-owned session
    if (dev.enabled) {
      const admin = createAdminClient()

      // Fetch current messages (admin bypasses RLS)
      const { data: row, error: fetchError } = await admin
        .from('sessions')
        .select('messages')
        .eq('id', sessionId)
        .single()

      if (fetchError) throw fetchError

      const messages = Array.isArray(row?.messages) ? row.messages : []
      const newMessage = { role, content, timestamp: new Date().toISOString() }
      const updatedMessages = [...messages, newMessage]

      const { error: updateError } = await admin
        .from('sessions')
        .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
        .eq('id', sessionId)

      if (updateError) throw updateError

      return jsonResponse({ ok: true, stored: true })
    }

    return errorResponse('Unauthorized', 401)
  } catch (error) {
    console.error('Session message API error:', error)
    return errorResponse('Failed to store message', 500)
  }
}

