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
      data: { session },
    } = await supabase.auth.getSession()
    return session?.user?.id
  } catch {
    return undefined
  }
}

export function createDevStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text))
      controller.close()
    },
  })
}

export function provideDevFallbackStream(text: string): Response {
  return new Response(createDevStream(text), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const

export async function handleAgentStream(
  messages: unknown,
  profile: Record<string, unknown>,
): Promise<Response> {
  try {
    const { createMastra } = await import('@/mastra')
    const mastra = createMastra(profile)
    const ifsAgent = mastra.getAgent('ifsAgent')

    const agent = ifsAgent as unknown as Partial<{
      streamVNext: (messages: unknown, opts?: unknown) => unknown
      stream: (messages: unknown) => unknown
    }>
    let stream: unknown = null
    if (typeof agent.streamVNext === 'function') {
      stream = (await agent.streamVNext(messages, { format: 'aisdk' })) as unknown
      const response = resolveStreamResponse(stream)
      if (response) return response
    }

    if (!stream && typeof agent.stream === 'function') {
      stream = (await agent.stream(messages)) as unknown
      const response = resolveStreamResponse(stream)
      if (response) return response
    }

    const response = resolveStreamResponse(stream)
    if (response) return response

    console.error(
      'Unsupported stream type from agent. Keys:',
      typeof stream === 'object' && stream !== null
        ? Object.keys(stream as Record<string, unknown>)
        : typeof stream,
    )
    return provideDevFallbackStream('Hello! (fallback)\nAgent returned unsupported stream shape.')
  } catch (error) {
    console.error('Error creating stream', error)
    return provideDevFallbackStream(
      'Hello! (dev fallback stream)\nAgent streaming is unavailable (check OPENROUTER_API_KEY/model).',
    )
  }
}

type StreamResolver = (candidate: unknown) => Response | undefined

const STREAM_RESOLVERS: StreamResolver[] = [
  responseFromUIMessageStream,
  responseFromDataStreamResponse,
  responseFromReadableStream,
  responseFromToResponse,
  responseFromToStreamResponse,
  responseFromResponseLike,
  responseFromAsyncIterable,
]

export function resolveStreamResponse(candidate: unknown): Response | undefined {
  for (const resolver of STREAM_RESOLVERS) {
    const response = resolver(candidate)
    if (response) return response
  }
  return undefined
}

export function responseFromUIMessageStream(candidate: unknown): Response | undefined {
  if (!candidate || typeof candidate !== 'object') return undefined
  const method = (candidate as { toUIMessageStreamResponse?: unknown }).toUIMessageStreamResponse
  if (typeof method !== 'function') return undefined
  return method.call(candidate, { sendReasoning: false })
}

export function responseFromDataStreamResponse(candidate: unknown): Response | undefined {
  if (!candidate || typeof candidate !== 'object') return undefined
  const method = (candidate as { toDataStreamResponse?: unknown }).toDataStreamResponse
  if (typeof method !== 'function') return undefined
  return method.call(candidate)
}

export function responseFromReadableStream(candidate: unknown): Response | undefined {
  if (!candidate || typeof candidate !== 'object') return undefined
  const method = (candidate as { toReadableStream?: unknown }).toReadableStream
  if (typeof method !== 'function') return undefined
  const readable = method.call(candidate) as ReadableStream<Uint8Array>
  return new Response(readable, { headers: NO_STORE_HEADERS })
}

export function responseFromToResponse(candidate: unknown): Response | undefined {
  if (!candidate || typeof candidate !== 'object') return undefined
  const method = (candidate as { toResponse?: unknown }).toResponse
  if (typeof method !== 'function') return undefined
  return method.call(candidate)
}

export function responseFromToStreamResponse(candidate: unknown): Response | undefined {
  if (!candidate || typeof candidate !== 'object') return undefined
  const method = (candidate as { toStreamResponse?: unknown }).toStreamResponse
  if (typeof method !== 'function') return undefined
  return method.call(candidate)
}

export function responseFromResponseLike(candidate: unknown): Response | undefined {
  if (!candidate || (typeof candidate !== 'object' && typeof candidate !== 'function')) {
    return undefined
  }
  if (candidate instanceof Response) {
    return candidate
  }
  if ('body' in candidate && 'headers' in candidate) {
    return candidate as Response
  }
  return undefined
}

export function responseFromAsyncIterable(candidate: unknown): Response | undefined {
  if (!candidate || (typeof candidate !== 'object' && typeof candidate !== 'function')) {
    return undefined
  }
  if (!(Symbol.asyncIterator in (candidate as Record<PropertyKey, unknown>))) {
    return undefined
  }
  const encoder = new TextEncoder()
  const asyncIterable = candidate as AsyncIterable<unknown>
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      for await (const chunk of asyncIterable) {
        const text = typeof chunk === 'string' ? chunk : JSON.stringify(chunk)
        controller.enqueue(encoder.encode(text))
      }
      controller.close()
    },
  })
  return new Response(readable, { headers: NO_STORE_HEADERS })
}
