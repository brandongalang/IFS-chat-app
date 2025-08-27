import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()

    if (!sessionId || typeof sessionId !== 'string') {
      return new Response(JSON.stringify({ error: 'sessionId is required' }), {
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
      // Dev fallback when Supabase env is not configured
      return new Response(JSON.stringify({ ok: true, ended: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { chatSessionService } = await import('@/lib/session-service')
    await chatSessionService.endSession(sessionId)

    return new Response(JSON.stringify({ ok: true, ended: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Session end API error:', error)
    return new Response(JSON.stringify({ error: 'Failed to end session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

