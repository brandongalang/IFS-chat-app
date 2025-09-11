import { createClient } from '@/lib/supabase/server'

export async function getUserIdFromSupabase(): Promise<string | undefined> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const hasSupabase =
    typeof supabaseUrl === 'string' && /^https?:\/\//.test(supabaseUrl) &&
    typeof supabaseAnon === 'string' && supabaseAnon.length > 20

  if (!hasSupabase) {
    return undefined
  }
  try {
    const supabase = await createClient()
    const {
      data: { session }
    } = await supabase.auth.getSession()
    return session?.user?.id
  } catch {
    // If Supabase is misconfigured in local dev, continue without a user
    return undefined
  }
}

export function createDevStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text))
      controller.close()
    }
  })
}

export function provideDevFallbackStream(text: string): Response {
  return new Response(createDevStream(text), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  })
}

export async function handleAgentStream(
  messages: unknown,
  profile: Record<string, unknown>
): Promise<Response> {
  try {
    // Lazy-load Mastra only when credentials are available to avoid dev import side-effects
    const { createMastra } = await import('@/mastra')
    const mastra = createMastra(profile)
    const ifsAgent = mastra.getAgent('ifsAgent')

    // Prefer vNext streaming in AI SDK (UI message) format so we can parse consistently on the client
    const agent = ifsAgent as unknown as Partial<{
      streamVNext: (messages: unknown, opts?: unknown) => unknown
      stream: (messages: unknown) => unknown
    }>
    let stream: unknown = null
    if (typeof agent.streamVNext === 'function') {
      const vNext = (await agent.streamVNext(messages, { format: 'aisdk' })) as unknown
      stream = vNext
      if (
        vNext &&
        typeof (vNext as { toUIMessageStreamResponse?: unknown }).toUIMessageStreamResponse === 'function'
      ) {
        return (vNext as {
          toUIMessageStreamResponse: (opts: { sendReasoning: boolean }) => Response
        }).toUIMessageStreamResponse({ sendReasoning: false })
      }
    }
    // Fallback to v2 streaming
    if (!stream && typeof agent.stream === 'function') {
      const v2 = (await agent.stream(messages)) as unknown
      if (v2 && typeof (v2 as { toDataStreamResponse?: unknown }).toDataStreamResponse === 'function') {
        return (v2 as { toDataStreamResponse: () => Response }).toDataStreamResponse()
      }
      if (v2 && typeof (v2 as { toReadableStream?: unknown }).toReadableStream === 'function') {
        return new Response((v2 as { toReadableStream: () => ReadableStream<Uint8Array> }).toReadableStream(), {
          headers: { 'Cache-Control': 'no-store' }
        })
      }
      stream = v2
    }

    // Adapt to the returned stream type
    const candidate = stream as Record<string, unknown> | undefined
    if (
      candidate &&
      typeof (candidate as { toDataStreamResponse?: unknown }).toDataStreamResponse === 'function'
    ) {
      return (candidate as { toDataStreamResponse: () => Response }).toDataStreamResponse()
    }
    if (
      candidate &&
      typeof (candidate as { toReadableStream?: unknown }).toReadableStream === 'function'
    ) {
      return new Response(
        (candidate as { toReadableStream: () => ReadableStream<Uint8Array> }).toReadableStream(),
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }
    if (candidate && typeof (candidate as { toResponse?: unknown }).toResponse === 'function') {
      return (candidate as { toResponse: () => Response }).toResponse()
    }
    if (
      candidate &&
      typeof (candidate as { toStreamResponse?: unknown }).toStreamResponse === 'function'
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
    console.error(
      'Unsupported stream type from agent. Keys:',
      typeof candidate === 'object' ? Object.keys(candidate as Record<string, unknown>) : typeof candidate
    )
    return provideDevFallbackStream(
      'Hello! (fallback)\nAgent returned unsupported stream shape.'
    )
  } catch (err) {
    console.error('Error creating stream', err)
    // Dev fallback stream on any error from agent/model/auth
    return provideDevFallbackStream(
      'Hello! (dev fallback stream)\nAgent streaming is unavailable (check OPENROUTER_API_KEY/model).'
    )
  }
}

