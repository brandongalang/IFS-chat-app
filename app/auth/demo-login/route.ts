import { NextResponse } from 'next/server'

import { getServiceClient, getUserClient, type SupabaseDatabaseClient } from '@/lib/supabase/clients'
import { isDemoAuthEnabled, requireDemoAuthCredentials } from '@/config/demo-auth'
import type { User } from '@supabase/supabase-js'

async function findUserByEmail(
  serviceClient: SupabaseDatabaseClient,
  email: string,
): Promise<{ user: User | null; error: Error | null }> {
  let page = 1

  try {
    while (true) {
      const {
        data,
        error,
      } = await serviceClient.auth.admin.listUsers({
        page,
        perPage: 200,
      })

      if (error) {
        return { user: null, error }
      }

      const match = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase())
      if (match) {
        return { user: match, error: null }
      }

      if (!data.nextPage) {
        break
      }

      page = data.nextPage
    }

    return { user: null, error: null }
  } catch (error) {
    return { user: null, error: error instanceof Error ? error : new Error('Unknown listUsers error') }
  }
}

export async function POST() {
  if (!isDemoAuthEnabled()) {
    console.info('Demo auth requested while disabled')
    return NextResponse.json({ error: 'Demo auth is disabled' }, { status: 403 })
  }

  let credentials
  try {
    credentials = requireDemoAuthCredentials()
  } catch (error) {
    console.error('Demo auth credentials are missing', error)
    return NextResponse.json({ error: 'Demo auth credentials are not configured' }, { status: 500 })
  }

  const serviceClient = getServiceClient()

  const hasAdminApi = Boolean(
    serviceClient?.auth && 'admin' in serviceClient.auth && serviceClient.auth.admin
  )

  if (!hasAdminApi) {
    console.error('Demo auth cannot proceed: Supabase service role client is not configured')
    return NextResponse.json(
      { error: 'Demo auth requires Supabase service role credentials' },
      { status: 500 }
    )
  }

  try {
    const { user: existingUser, error: findUserError } = await findUserByEmail(
      serviceClient,
      credentials.email,
    )

    if (findUserError) {
      console.error('Demo auth failed to lookup user', findUserError)
      return NextResponse.json({ error: 'Failed to prepare demo user' }, { status: 500 })
    }

    if (!existingUser) {
      const {
        data: createdUser,
        error: createError,
      } = await serviceClient.auth.admin.createUser({
        email: credentials.email,
        password: credentials.password,
        email_confirm: true,
        user_metadata: { source: 'demo-auth' },
      })

      if (createError || !createdUser?.user) {
        console.error('Demo auth failed to create user', createError)
        return NextResponse.json({ error: 'Failed to provision demo user' }, { status: 500 })
      }
    } else {
      const { error: updateError } = await serviceClient.auth.admin.updateUserById(existingUser.id, {
        password: credentials.password,
        email_confirm: true,
      })

      if (updateError) {
        console.warn('Demo auth could not update existing user password', updateError)
      }
    }

    const userClient = await getUserClient()

    const signOutResult = await userClient.auth.signOut()
    if (signOutResult?.error) {
      console.warn('Demo auth sign-out before login reported an error', signOutResult.error)
    }

    const { data: signInData, error: signInError } = await userClient.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    })

    if (signInError || !signInData?.session) {
      console.error('Demo auth sign-in failed', signInError)
      return NextResponse.json({ error: 'Failed to start demo session' }, { status: 500 })
    }

    const session = signInData.session

    if (!session.refresh_token || !session.access_token) {
      console.error('Demo auth received session without tokens')
      return NextResponse.json({ error: 'Demo session is incomplete' }, { status: 500 })
    }

    const { error: setSessionError } = await userClient.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })

    if (setSessionError) {
      console.error('Demo auth failed to persist session', setSessionError)
      return NextResponse.json({ error: 'Failed to persist demo session' }, { status: 500 })
    }

    return NextResponse.json({
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type,
        provider_token: session.provider_token ?? null,
      },
      user: session.user,
    })
  } catch (error) {
    console.error('Demo auth encountered an unexpected error', error)
    return NextResponse.json({ error: 'Demo auth failed unexpectedly' }, { status: 500 })
  }
}
