import { NextRequest } from 'next/server'
import { dev } from '@/config/dev'
import { errorResponse } from '@/lib/api/response'
import { getUserIdFromSupabase, provideDevFallbackStream, handleAgentStream } from './logic'
import { summarizePendingUpdatesForUser } from '@/lib/memory/update-runner'
import { readJsonBody, isRecord } from '@/lib/api/request'

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req)
    if (!isRecord(body) || !Array.isArray(body.messages)) {
      return errorResponse('Messages array is required', 400)
    }

    const messages = body.messages
    const profile = isRecord(body.profile) ? body.profile : {}

    const userId = await getUserIdFromSupabase()

    if (!userId && !dev.enabled) {
      return errorResponse('Unauthorized', 401)
    }

    const secureProfile: Record<string, unknown> = { ...profile, userId }

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

    const baseURL = process.env.OPENROUTER_BASE_URL
    const hasOpenrouter = typeof process.env.OPENROUTER_API_KEY === 'string' && process.env.OPENROUTER_API_KEY.length > 10
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
