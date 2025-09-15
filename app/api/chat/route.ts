import { NextRequest } from 'next/server'
import { dev } from '@/config/dev'
<<<<<<< HEAD
import { errorResponse } from '@/lib/api/response'
import { getUserIdFromSupabase, provideDevFallbackStream, handleAgentStream } from './logic'
import { summarizePendingUpdatesForUser } from '@/lib/memory/update-runner'
=======
import { jsonResponse, errorResponse } from '@/lib/api/response'
>>>>>>> pr/106

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

    // Add the secure user ID to the profile object
    const secureProfile = { ...profile, userId }

    // Memory v2 first-run scaffolding: ensure overview exists for this user
    try {
      const { isMemoryV2Enabled } = await import('@/lib/memory/config')
      if (userId && isMemoryV2Enabled()) {
        await import('@/lib/memory/snapshots/scaffold').then(({ ensureOverviewExists }) => ensureOverviewExists(userId))
      }
    } catch (e) {
      console.warn('first-run scaffold skipped', e)
    }

    // Run the update summarizer to keep the change log in sync before chatting
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

    // If no OpenRouter credentials, provide a dev fallback text stream so the UI works
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
