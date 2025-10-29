import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { dev } from '@/config/dev'
import { getSupabaseKey, getSupabaseUrl } from './config'

interface SupabaseSessionPayload {
  access_token?: string
  user?: {
    id?: string
  }
}

const ONBOARDING_COOKIE = 'ifs_onb'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const url = getSupabaseUrl()
  const key = getSupabaseKey()

  // Dev fallback: if Supabase env is not configured, allow request to pass through
  if (!url || !key) {
    // Optional: add a header to aid debugging in dev logs
    supabaseResponse.headers.set('x-supabase-middleware', 'bypassed')
    return supabaseResponse
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
      },
    },
  })

  const {
    data: { session: supabaseSession },
  } = await supabase.auth.getSession()

  const session =
    supabaseSession?.access_token && supabaseSession.user?.id
      ? {
          access_token: supabaseSession.access_token,
          user: { id: supabaseSession.user.id },
        }
      : undefined

  // Auth check
  // In development persona mode, do not force login redirect for unauthenticated users,
  // but still allow onboarding redirects for authenticated users below.
  const isDevPersona = dev.enabled === true

  const path = request.nextUrl.pathname

  // If unauthenticated and not in dev persona mode, redirect to login (except /auth and /login)
  if (!session && !isDevPersona) {
    // Allow cron endpoints without authentication
    if (path.startsWith('/api/cron/')) {
      return supabaseResponse
    }
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
      const onbCookie = request.cookies.get(ONBOARDING_COOKIE)?.value
      // Determine if path is in the "allowed" zone (auth/onboarding)
      const isAllowed = path.startsWith('/onboarding') || path.startsWith('/auth')

      let status: 'completed' | 'incomplete' | undefined

      if (onbCookie === '1') {
        status = 'completed'
      } else if (onbCookie === '0') {
        status = 'incomplete'
      } else {
        status = await fetchOnboardingStatus(url, key, session)
        if (status) {
          const maxAge = 60 * 60 * 6 // 6 hours
          supabaseResponse.cookies.set(ONBOARDING_COOKIE, status === 'completed' ? '1' : '0', {
            path: '/',
            maxAge,
            sameSite: 'lax',
          })
        }
      }

      const isCompleted = status === 'completed'

      // Prevent loop: if user completed but hits /onboarding, send to home
      if (path.startsWith('/onboarding') && isCompleted) {
        const redirect = NextResponse.redirect(new URL('/today', request.url))
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

async function fetchOnboardingStatus(
  supabaseUrl: string,
  anonKey: string,
  session: SupabaseSessionPayload
): Promise<'completed' | 'incomplete' | undefined> {
  const userId = session.user?.id
  const accessToken = session.access_token
  if (!userId || !accessToken) return undefined

  try {
    const searchParams = new URLSearchParams({
      select: 'status',
      user_id: `eq.${userId}`,
      limit: '1',
    })
    const response = await fetch(`${supabaseUrl}/rest/v1/user_onboarding?${searchParams.toString()}`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      console.warn('Failed to fetch onboarding status', response.status, response.statusText)
      return undefined
    }

    const data = (await response.json()) as Array<{ status?: string }>
    const status = data[0]?.status
    if (status === 'completed' || status === 'incomplete') {
      return status
    }
  } catch (error) {
    console.warn('Error querying onboarding status', error)
  }

  return undefined
}
