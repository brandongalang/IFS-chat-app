import { NextRequest } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dev } from '@/config/dev'
import { getSupabaseKey, getSupabaseUrl } from '@/lib/supabase/config'

export async function POST(req: NextRequest) {
  try {
    const { sessionId, role, content } = await req.json()

    if (!sessionId || (role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = getSupabaseUrl()
    const supabaseAnon = getSupabaseKey()
    const hasSupabase =
      typeof supabaseUrl === 'string' && /^https?:\/\//.test(supabaseUrl) &&
      typeof supabaseAnon === 'string' && supabaseAnon.length > 20

    if (!hasSupabase) {
      // Development fallback when Supabase env is not configured
      return new Response(JSON.stringify({ ok: true, stored: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Try authenticated user path first (RLS-protected)
    const supabase = await createServerSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    const authedUserId = session?.user?.id

    if (authedUserId) {
      const { chatSessionService } = await import('@/lib/session-service')
      await chatSessionService.addMessage(sessionId, { role, content })
      return new Response(JSON.stringify({ ok: true, stored: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
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

      return new Response(JSON.stringify({ ok: true, stored: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Session message API error:', error)
    return new Response(JSON.stringify({ error: 'Failed to store message' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

