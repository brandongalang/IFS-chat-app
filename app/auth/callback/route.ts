import { NextResponse } from 'next/server'
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

export async function POST(request: Request) {
  try {
    const { event, session } = (await request.json()) as AuthCallbackPayload
    const supabase = await createClient()

    if (event === 'SIGNED_OUT') {
      await supabase.auth.signOut()
    } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      if (session) {
        await supabase.auth.setSession(session)
      } else {
        console.warn('Auth callback POST missing session for event:', event)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error handling auth callback POST request:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
