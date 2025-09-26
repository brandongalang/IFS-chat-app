import { NextRequest } from 'next/server'
import { dev } from '@/config/dev'
import { errorResponse } from '@/lib/api/response'
import { getUserIdFromSupabase, provideDevFallbackStream } from './logic'
import { summarizePendingUpdatesForUser } from '@/lib/memory/update-runner'
import { createMastra } from '@/mastra'

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

    const baseURL = process.env.OPENROUTER_BASE_URL
    const hasOpenrouter = typeof process.env.OPENROUTER_API_KEY === 'string' && process.env.OPENROUTER_API_KEY.length > 10
    console.log('[CHAT] OpenRouter env', { hasOpenrouter, baseURL })
    if (!hasOpenrouter) {
      return provideDevFallbackStream(
        'Hello! (dev fallback stream)\nThis is a placeholder response because OPENROUTER_API_KEY is not configured.'
      )
    }

    try {
      const mastra = createMastra(secureProfile)
      const agent = mastra.getAgent?.('ifsAgent') ?? mastra.agents?.ifsAgent

      if (!agent || typeof agent.streamVNext !== 'function') {
        console.error('[CHAT] ifsAgent missing streamVNext')
        return provideDevFallbackStream(
          'Hello! (fallback)\nAgent streaming is unavailable (missing streamVNext).',
        )
      }

      const stream = await agent.streamVNext(messages, { format: 'aisdk' })

      if (!stream || typeof stream.toDataStreamResponse !== 'function') {
        console.error('[CHAT] streamVNext did not return AISDK stream shape')
        return provideDevFallbackStream(
          'Hello! (fallback)\nAgent streaming returned an unexpected response shape.',
        )
      }

      return stream.toDataStreamResponse()
    } catch (streamError) {
      console.error('[CHAT] Agent streaming failed', streamError)
      return provideDevFallbackStream(
        'Hello! (fallback)\nAgent streaming failed to initialize.',
      )
    }
  } catch (error) {
    console.error('Chat API error:', error)
    return errorResponse('Something went wrong', 500)
  }
}
