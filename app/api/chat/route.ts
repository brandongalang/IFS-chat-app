import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { dev } from '@/config/dev'

export async function POST(req: NextRequest) {
  try {
    const { messages, profile } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Only attempt to create a Supabase server client if env is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const hasSupabase =
      typeof supabaseUrl === 'string' && /^https?:\/\//.test(supabaseUrl) &&
      typeof supabaseAnon === 'string' && supabaseAnon.length > 20

    let userId: string | undefined = undefined
    if (hasSupabase) {
      try {
        const supabase = await createClient()
        const { data: { session } } = await supabase.auth.getSession()
        userId = session?.user?.id
      } catch (e) {
        // If Supabase is misconfigured in local dev, continue without a user
        userId = undefined
      }
    }

    if (!userId && !dev.enabled) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Add the secure user ID to the profile object
    const secureProfile = { ...profile, userId: userId }

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
      const encoder = new TextEncoder()
      const devText = 'Hello! (dev fallback stream)\nThis is a placeholder response because OPENROUTER_API_KEY is not configured.'
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(devText))
          controller.close()
        }
      })
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store'
        }
      })
    }

    try {
      // Lazy-load the agent only when credentials are available to avoid dev import side-effects
const { createIfsAgent } = await import('../../../mastra/agents/ifs-agent')
      const ifsAgent = createIfsAgent(secureProfile)

      // Prefer vNext streaming in AI SDK (UI message) format so we can parse consistently on the client
      const agent = ifsAgent as unknown as Partial<{
        streamVNext: (messages: unknown, opts?: unknown) => unknown
        stream: (messages: unknown) => unknown
      }>
      let stream: unknown = null
      if (typeof agent.streamVNext === 'function') {
        const vNext = await (agent.streamVNext(messages, { format: 'aisdk' }) as unknown)
        stream = vNext
        if (
          vNext && typeof (vNext as { toUIMessageStreamResponse?: unknown }).toUIMessageStreamResponse === 'function'
        ) {
          return (vNext as { toUIMessageStreamResponse: (opts: { sendReasoning: boolean }) => Response }).toUIMessageStreamResponse({ sendReasoning: false })
        }
      }
      // Fallback to v2 streaming
      if (!stream && typeof agent.stream === 'function') {
        const v2 = await (agent.stream(messages) as unknown)
        if (v2 && typeof (v2 as { toDataStreamResponse?: unknown }).toDataStreamResponse === 'function') {
          return (v2 as { toDataStreamResponse: () => Response }).toDataStreamResponse()
        }
        if (v2 && typeof (v2 as { toReadableStream?: unknown }).toReadableStream === 'function') {
          return new Response((v2 as { toReadableStream: () => ReadableStream<Uint8Array> }).toReadableStream(), { headers: { 'Cache-Control': 'no-store' } })
        }
        stream = v2
      }

      // Adapt to the returned stream type
      const candidate = stream as Record<string, unknown> | undefined
      if (
        candidate && typeof (candidate as { toDataStreamResponse?: unknown }).toDataStreamResponse === 'function'
      ) {
        return (candidate as { toDataStreamResponse: () => Response }).toDataStreamResponse()
      }
      if (
        candidate && typeof (candidate as { toReadableStream?: unknown }).toReadableStream === 'function'
      ) {
        return new Response((candidate as { toReadableStream: () => ReadableStream<Uint8Array> }).toReadableStream(), { headers: { 'Cache-Control': 'no-store' } })
      }
      if (candidate && typeof (candidate as { toResponse?: unknown }).toResponse === 'function') {
        return (candidate as { toResponse: () => Response }).toResponse()
      }
      if (
        candidate && typeof (candidate as { toStreamResponse?: unknown }).toStreamResponse === 'function'
      ) {
        return (candidate as { toStreamResponse: () => Response }).toStreamResponse()
      }
      if (candidate && typeof candidate === 'object' && 'body' in candidate && 'headers' in candidate) {
        // Looks like a web Response
        return candidate as unknown as Response
      }
      if (candidate && Symbol.asyncIterator in candidate) {
        // If it's an async iterator of chunks
        const encoder = new TextEncoder()
        const asyncIter = candidate as AsyncIterable<unknown>
        const rs = new ReadableStream<Uint8Array>({
          async start(controller) {
            for await (const chunk of asyncIter) {
              const text = typeof chunk === 'string' ? chunk : JSON.stringify(chunk)
              controller.enqueue(encoder.encode(text))
            }
            controller.close()
          }
        })
        return new Response(rs, { headers: { 'Cache-Control': 'no-store' } })
      }

      // Fallback: dev stream instead of 500 to keep UI responsive
      console.error('Unsupported stream type from agent. Keys:', typeof candidate === 'object' ? Object.keys(candidate as Record<string, unknown>) : typeof candidate)
      const encoder = new TextEncoder()
      const msg = 'Hello! (fallback)\nAgent returned unsupported stream shape.'
      const rs = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(msg))
          controller.close()
        }
      })
      return new Response(rs, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
    } catch (err) {
      console.error('Error creating stream', err)
      // Dev fallback stream on any error from agent/model/auth
      const encoder = new TextEncoder()
      const msg = 'Hello! (dev fallback stream)\nAgent streaming is unavailable (check OPENROUTER_API_KEY/model).'
      const rs = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(msg))
          controller.close()
        }
      })
      return new Response(rs, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
    }

  } catch (error) {
    console.error('Chat API error:', error)
    return new Response(JSON.stringify({ error: 'Something went wrong' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}