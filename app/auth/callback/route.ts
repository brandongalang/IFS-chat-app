import { NextResponse } from 'next/server'
import { BASE_URL } from '@/config/app'
import { createClient } from '@/lib/supabase/server'
import type { Session } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error_code = searchParams.get('error')
  const error_description = searchParams.get('error_description')
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/'

  // Check for OAuth errors first
  if (error_code) {
    console.error('OAuth callback error:', {
      error_code,
      error_description,
      searchParams: Object.fromEntries(searchParams.entries())
    })
    return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(error_description || 'OAuth authentication failed')}`)
  }

  if (code) {
    try {
      const supabase = await createClient()
      const { error, data } = await supabase.auth.exchangeCodeForSession(code)
      
      if (!error && data?.session) {
        console.log('OAuth callback successful for user:', data.user?.email)
        return NextResponse.redirect(`${origin}${next}`)
      }
      
      if (error) {
        console.error('Code exchange error:', error)
        return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(error.message)}`)
      }
    } catch (err) {
      console.error('Unexpected callback error:', err)
      return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent('Authentication failed')}`)
    }
  }

  // No code provided
  console.warn('OAuth callback without code or error')
  return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent('Invalid authentication callback')}`)
}

type AuthCallbackPayload = {
  event?: string
  session?: Session | null
}

const allowedEvents = new Set(['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'SIGNED_OUT'])

function normalizeOrigin(origin: string | null): string | null {
  if (!origin) {
    return null
  }
  try {
    return new URL(origin).origin
  } catch {
    return null
  }
}

function buildAllowedOriginsFromRequest(request: Request): Set<string> {
  const { origin } = new URL(request.url)

  const candidates: Array<string | null | undefined> = [
    origin,
    BASE_URL,
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.BASE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ]

  return new Set(
    candidates
      .map((value) => normalizeOrigin(value ?? null))
      .filter((value): value is string => Boolean(value))
  )
}

function isAllowedOrigin(request: Request) {
  const originHeader = request.headers.get('origin')
  if (!originHeader) {
    return true
  }

  const normalized = normalizeOrigin(originHeader)
  if (!normalized) {
    return false
  }

  const allowedOrigins = buildAllowedOriginsFromRequest(request)
  return allowedOrigins.has(normalized)
}

export async function POST(request: Request) {
  try {
    if (!isAllowedOrigin(request)) {
      console.warn('Auth callback POST rejected due to disallowed origin', {
        origin: request.headers.get('origin'),
      })
      return NextResponse.json({ success: false }, { status: 403 })
    }

    const { event, session } = (await request.json()) as AuthCallbackPayload
    const supabase = await createClient()

    if (!event || !allowedEvents.has(event)) {
      console.warn('Auth callback POST received unsupported event', { event })
      return NextResponse.json({ success: true })
    }

    if (event === 'SIGNED_OUT') {
      await supabase.auth.signOut()
      return NextResponse.json({ success: true })
    }

    const {
      data: { session: existingSession },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      if (event === 'INITIAL_SESSION') {
        console.info('Auth callback received initial session with no active session; clearing cookies')
        await supabase.auth.signOut()
        return NextResponse.json({ success: true })
      }
      console.warn('Auth callback POST missing access token', { event })
      return NextResponse.json({ success: false }, { status: 400 })
    }

    const refreshToken = session.refresh_token ?? existingSession?.refresh_token
    if (!refreshToken) {
      console.warn('Auth callback POST missing refresh token with no fallback available', { event })
      return NextResponse.json({ success: false }, { status: 400 })
    }

    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser(session.access_token)

    if (userError || !userData?.user) {
      console.error('Auth callback failed to verify session user', userError)
      return NextResponse.json({ success: false }, { status: 401 })
    }

    if (session.user?.id && session.user.id !== userData.user.id) {
      console.error('Auth callback session user mismatch', {
        expected: session.user.id,
        actual: userData.user.id,
      })
      return NextResponse.json({ success: false }, { status: 403 })
    }

    const { error: setSessionError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: refreshToken,
    })

    if (setSessionError) {
      console.error('Auth callback failed to persist session', setSessionError)
      return NextResponse.json({ success: false }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error handling auth callback POST request:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
