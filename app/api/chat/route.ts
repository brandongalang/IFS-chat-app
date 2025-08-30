import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UserRow } from '@/lib/types/database'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single<UserRow>()

    if (profileError || !userProfile) {
      console.error('Chat API - User profile error:', profileError)
      return new Response(JSON.stringify({ error: 'User profile not found.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // --- Daily Message Limit Logic ---
    if (userProfile.subscription_status === 'free') {
      const today = new Date().toISOString().split('T')[0]
      const lastMessageDate = userProfile.last_message_date
        ? new Date(userProfile.last_message_date).toISOString().split('T')[0]
        : null
      const dailyLimit = parseInt(process.env.FREE_TIER_DAILY_MESSAGE_LIMIT || '15', 10)

      let currentCount = userProfile.daily_message_count
      let needsUpdate = false

      if (lastMessageDate !== today) {
        // First message of a new day, reset counter
        currentCount = 1
        needsUpdate = true
      } else {
        // It's the same day, check limit
        if (currentCount >= dailyLimit) {
          return new Response(
            JSON.stringify({
              error: 'Daily message limit reached. Please upgrade for unlimited messages.',
            }),
            { status: 429, headers: { 'Content-Type': 'application/json' } }
          )
        }
        currentCount++
        needsUpdate = true
      }

      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('users')
          .update({
            daily_message_count: currentCount,
            last_message_date: new Date().toISOString(),
          })
          .eq('id', user.id)

        if (updateError) {
          // Log the error but don't block the chat, as the check has already passed.
          console.error('Failed to update user message count:', updateError)
        }
      }
    }

    const { messages } = await req.json()
    // Use the securely fetched userProfile instead of one from the client
    const profile = userProfile

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // If no OpenRouter credentials, provide a dev fallback text stream so the UI works
    const hasOpenrouter = typeof process.env.OPENROUTER_API_KEY === 'string' && process.env.OPENROUTER_API_KEY.length > 10
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

    // --- AI Model Selection Logic ---
    let modelToUse: string
    if (userProfile.subscription_status === 'free') {
      modelToUse = process.env.FREE_TIER_MODEL || 'mistralai/mistral-7b-instruct'
    } else {
      modelToUse = process.env.PAID_TIER_MODEL || 'z-ai/glm-4.5'
    }
    // --- End AI Model Selection Logic ---

    try {
      // Lazy-load the agent only when credentials are available to avoid dev import side-effects
      const { createIfsAgent } = await import('../../../mastra/agents/ifs-agent')
      const ifsAgent = createIfsAgent(profile, { model: modelToUse })

      // Prefer vNext streaming in AI SDK (UI message) format so we can parse consistently on the client
      const agent = ifsAgent as unknown as Partial<{
        streamVNext: (messages: unknown, opts?: unknown) => unknown
        stream: (messages: unknown) => unknown
      }>
      let stream: unknown = null
      if (typeof agent.streamVNext === 'function') {
        const vNext = agent.streamVNext(messages, { format: 'aisdk' }) as unknown
        stream = vNext
        if (
          vNext && typeof (vNext as { toUIMessageStreamResponse?: unknown }).toUIMessageStreamResponse === 'function'
        ) {
          return (vNext as { toUIMessageStreamResponse: (opts: { sendReasoning: boolean }) => Response }).toUIMessageStreamResponse({ sendReasoning: false })
        }
      }
      // Fallback to v2 streaming
      if (!stream && typeof agent.stream === 'function') {
        const v2 = agent.stream(messages) as unknown
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