import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()

    if (!userId || typeof userId !== 'string') {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
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
      const devSessionId = `dev-${Math.random().toString(36).slice(2)}`
      return new Response(JSON.stringify({ sessionId: devSessionId }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { chatSessionService } = await import('../../../../lib/session-service')
    const sessionId = await chatSessionService.startSession(userId)

    return new Response(JSON.stringify({ sessionId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Session start API error:', error)
    return new Response(JSON.stringify({ error: 'Failed to start session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}


