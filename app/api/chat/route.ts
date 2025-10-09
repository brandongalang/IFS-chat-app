import { NextRequest } from 'next/server'
import { dev } from '@/config/dev'
import { ENV, OPENROUTER_API_BASE_URL } from '@/config/env'
import { errorResponse } from '@/lib/api/response'
import { getUserIdFromSupabase, provideDevFallbackStream, handleAgentStream } from './logic'

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const messages = payload?.messages
    const rawProfile = payload?.profile

    if (!messages || !Array.isArray(messages)) {
      return errorResponse('Messages array is required', 400)
    }

    const userId = await getUserIdFromSupabase()

    const profileIsObject = rawProfile && typeof rawProfile === 'object'
    const sanitizedProfile = profileIsObject ? { ...(rawProfile as Record<string, unknown>) } : {}
    const profileUserId =
      typeof sanitizedProfile.userId === 'string' && sanitizedProfile.userId.length > 0
        ? sanitizedProfile.userId
        : undefined
    const profileId =
      typeof (sanitizedProfile as { id?: unknown }).id === 'string' &&
      String((sanitizedProfile as { id?: unknown }).id).length > 0
        ? String((sanitizedProfile as { id?: unknown }).id)
        : undefined

    if (!userId && !dev.enabled) {
      return errorResponse('Unauthorized', 401)
    }

    if (userId && profileUserId && profileUserId !== userId) {
      console.warn('[CHAT] Overriding mismatched profile userId', {
        profileUserId,
        sessionUserId: userId,
      })
    }

    const derivedUserId = userId ?? profileUserId ?? profileId
    if (!derivedUserId) {
      console.warn('[CHAT] Missing userId for secureProfile payload', {
        devMode: dev.enabled,
        hasSupabaseSession: Boolean(userId),
        profileProvided: Boolean(profileIsObject),
      })
    }

    const secureProfile = {
      ...sanitizedProfile,
      userId: derivedUserId,
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
