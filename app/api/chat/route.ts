import { NextRequest } from 'next/server'
import { dev } from '@/config/dev'
import { ENV, OPENROUTER_API_BASE_URL } from '@/config/env'
import { errorResponse } from '@/lib/api/response'
import { getUserIdFromSupabase, provideDevFallbackStream, handleAgentStream } from './logic'

function normalizeProfile(
  rawProfile: unknown,
  sessionUserId: string | undefined,
): {
  profile: Record<string, unknown>
  derivedUserId?: string
  profileProvided: boolean
} {
  const coerceString = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  if (!rawProfile || typeof rawProfile !== 'object') {
    return { profile: {}, derivedUserId: sessionUserId, profileProvided: false }
  }

  const profile = { ...(rawProfile as Record<string, unknown>) }
  const profileUserId = coerceString(profile.userId)
  const profileId = coerceString((profile as { id?: unknown }).id)

  if (sessionUserId && profileUserId && profileUserId !== sessionUserId) {
    console.warn('[CHAT] Overriding mismatched profile userId', {
      profileUserId,
      sessionUserId,
    })
  }

  const derivedUserId = sessionUserId ?? profileUserId ?? profileId

  if (derivedUserId) {
    profile.userId = derivedUserId
  } else {
    delete profile.userId
  }

  return { profile, derivedUserId, profileProvided: true }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const messages = payload?.messages
    const rawProfile = payload?.profile

    if (!messages || !Array.isArray(messages)) {
      return errorResponse('Messages array is required', 400)
    }

    const userId = await getUserIdFromSupabase()
    const { profile: secureProfile, derivedUserId, profileProvided } = normalizeProfile(rawProfile, userId)

    if (!userId && !dev.enabled) {
      return errorResponse('Unauthorized', 401)
    }

    if (!derivedUserId) {
      console.warn('[CHAT] Missing userId for secureProfile payload', {
        devMode: dev.enabled,
        hasSupabaseSession: Boolean(userId),
        profileProvided,
      })
    }

    if (userId) {
      console.log('[CHAT] Memory maintenance deferred to cron worker', { userId })
    }

    const baseURL = OPENROUTER_API_BASE_URL
    const hasOpenrouter = typeof ENV.OPENROUTER_API_KEY === 'string' && ENV.OPENROUTER_API_KEY.length > 0
    console.log('[CHAT] OpenRouter env', { hasOpenrouter, baseURL })
    if (!hasOpenrouter) {
      return provideDevFallbackStream(
        'Hello! (dev fallback stream)\nThis is a placeholder response because OPENROUTER_API_KEY is not configured.'
      )
    }

    return handleAgentStream(messages, secureProfile)
  } catch (error) {
    console.error('Chat API error:', error)
    return errorResponse('Something went wrong', 500)
  }
}
