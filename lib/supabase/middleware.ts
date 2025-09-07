import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { dev } from '@/config/dev'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

  // Dev fallback: if Supabase env is not configured, allow request to pass through
  if (!url || !key) {
    // Optional: add a header to aid debugging in dev logs
    supabaseResponse.headers.set('x-supabase-middleware', 'bypassed')
    return supabaseResponse
  }

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and any auth calls.
  // A simple mistake could make it very hard to debug issues with sessions.

  // Auth check
  // In development persona mode, do not force login redirect for unauthenticated users,
  // but still allow onboarding redirects for authenticated users below.
  const isDevPersona = dev.enabled === true

  // Use session to reliably get the user id
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const path = request.nextUrl.pathname

  // If unauthenticated and not in dev persona mode, redirect to login (except /auth and /login)
  if (!session && !isDevPersona) {
    if (!path.startsWith('/login') && !path.startsWith('/auth')) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      const redirect = NextResponse.redirect(url)
      // Preserve cookies set by Supabase
      for (const c of supabaseResponse.cookies.getAll()) {
        redirect.cookies.set(c)
      }
      return redirect
    }
    // Allow auth routes
    return supabaseResponse
  }

  // At this point: either unauthenticated in dev persona mode OR authenticated.
  // Only perform onboarding redirects for authenticated users.
  if (session) {
    // Do not interfere with API, assets
    const isApi = path.startsWith('/api')
    const isAsset = path.startsWith('/_next') || /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/.test(path)
    if (!isApi && !isAsset) {
      // First, honor the lightweight cookie hint if present
      const onbCookie = request.cookies.get('ifs_onb')?.value
      // Determine if path is in the "allowed" zone (auth/onboarding)
      const isAllowed = path.startsWith('/onboarding') || path.startsWith('/auth')

      // If cookie is present and no redirect was needed above, skip DB lookup for perf
      if (onbCookie === '0' || onbCookie === '1') {
        return supabaseResponse
      }

      // Cookie missing — perform authoritative check
      // Lightweight onboarding status lookup
      const { data: onboarding } = await supabase
        .from('user_onboarding')
        .select('status')
        .eq('user_id', session.user.id)
        .maybeSingle()

      const status = onboarding?.status || 'incomplete'
      const isCompleted = status === 'completed'

      // Prevent loop: if user completed but hits /onboarding, send to home
      if (path.startsWith('/onboarding') && isCompleted) {
        const redirect = NextResponse.redirect(new URL('/', request.url))
        for (const c of supabaseResponse.cookies.getAll()) {
          redirect.cookies.set(c)
        }
        return redirect
      }

      // Redirect incomplete users away from non-allowed paths to /onboarding
      if (!isCompleted && !isAllowed) {
        const redirect = NextResponse.redirect(new URL('/onboarding', request.url))
        for (const c of supabaseResponse.cookies.getAll()) {
          redirect.cookies.set(c)
        }
        return redirect
      }
    }
  }

  // IMPORTANT: You must return the supabaseResponse object as it is for pass-through.
  return supabaseResponse
}
