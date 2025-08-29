import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { developmentConfig, devLog } from '@/mastra/config/development'

export async function updateSession(request: NextRequest) {
  // DEV BYPASS: Enabled only when NODE_ENV !== 'production' AND IFS_DEV_MODE==='true'
  if (developmentConfig.enabled) {
    const devUserId = developmentConfig.defaultUserId
    if (devUserId) {
      const res = NextResponse.next({ request })
      // Non-sensitive dev cookies + headers to help the app identify "mock user"
      res.headers.set('x-ifs-dev-mode', 'true')
      res.headers.set('x-ifs-dev-user-id', devUserId)
      res.cookies.set('ifs_dev_mode', 'true', { httpOnly: false, sameSite: 'lax', path: '/' })
      res.cookies.set('ifs_dev_user_id', devUserId, { httpOnly: false, sameSite: 'lax', path: '/' })
      devLog('Middleware: bypassing Supabase auth in dev mode', { devUserId })
      return res
    } else {
      devLog('Middleware: dev mode enabled but IFS_DEFAULT_USER_ID not set — falling back to normal auth flow')
    }
  }

  // NORMAL AUTH FLOW (unchanged)
  let supabaseResponse = NextResponse.next({
    request,
  })

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!

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

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
