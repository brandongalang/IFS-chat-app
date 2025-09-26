import { NextRequest } from 'next/server'
import { dev } from '@/config/dev'
import { ENV } from '@/config/env'
import { errorResponse } from '@/lib/api/response'
import { getUserIdFromSupabase, provideDevFallbackStream, handleAgentStream } from './logic'
import { summarizePendingUpdatesForUser } from '@/lib/memory/update-runner'

export async function POST(req: NextRequest) {
  try {
    const { messages, profile } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return errorResponse('Messages array is required', 400)
    }

    const userId = await getUserIdFromSupabase()

    if (!userId && !dev.enabled) {
      return errorResponse('Unauthorized', 401)
    }

    const secureProfile = { ...profile, userId }

    try {
      const { isMemoryV2Enabled } = await import('@/lib/memory/config')
      if (userId && isMemoryV2Enabled()) {
        await import('@/lib/memory/snapshots/scaffold').then(({ ensureOverviewExists }) => ensureOverviewExists(userId))
      }
    } catch (error) {
      console.warn('first-run scaffold skipped', error)
    }

    if (userId) {
      try {
        const outcome = await summarizePendingUpdatesForUser(userId)
        if (!outcome.skipped && outcome.itemCount > 0) {
          console.log('[CHAT] Cleared pending memory updates', {
            userId,
            processed: outcome.itemCount,
            digest: outcome.digest,
          })
        }
      } catch (error) {
        console.warn('[CHAT] update summarizer failed', error)
      }
    }

    const baseURL = ENV.IFS_PROVIDER_BASE_URL ?? ENV.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1'
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
