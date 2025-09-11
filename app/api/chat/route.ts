import { NextRequest } from 'next/server'
import { dev } from '@/config/dev'
import {
  getUserIdFromSupabase,
  provideDevFallbackStream,
  handleAgentStream
} from './logic'

export async function POST(req: NextRequest) {
  try {
    const { messages, profile } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const userId = await getUserIdFromSupabase()

    if (!userId && !dev.enabled) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
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
    return new Response(JSON.stringify({ error: 'Something went wrong' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}