import { NextResponse } from 'next/server'

const ALLOWED = new Set(['beginner','moderate','advanced'])

export async function GET() {
  // For quick debugging, return current cookie value (non-sensitive)
  const res = NextResponse.json({ ok: true })
  return res
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const persona = String(body?.persona || '')
    if (!ALLOWED.has(persona)) {
      return NextResponse.json({ ok: false, error: 'invalid_persona' }, { status: 400 })
    }
    const res = NextResponse.json({ ok: true, persona })
    // Set a server-visible cookie so SSR/API can read it
    res.cookies.set('ifs-test-persona', persona, {
      httpOnly: false, // client must read this in Garden (client-side data fetch)
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })
    return res
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unknown_error' }, { status: 500 })
  }
}
