import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { sessionId, role, content } = await req.json()

    if (!sessionId || (role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
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

    const { chatSessionService } = await import('@/lib/session-service')
    await chatSessionService.addMessage(sessionId, { role, content })

    return new Response(JSON.stringify({ ok: true, stored: true }), {
      status: 200,
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

