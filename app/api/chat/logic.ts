import { env } from '@/config/env'
import { loadUnifiedUserContext } from '@/lib/memory/unified-loader'
import { getUserClient } from '@/lib/supabase/clients'
import { getSupabaseKey, getSupabaseUrl } from '@/lib/supabase/config'

export async function getUserIdFromSupabase(): Promise<string | undefined> {
  const supabaseUrl = getSupabaseUrl()
  const supabaseAnon = getSupabaseKey()
  const hasSupabase =
    typeof supabaseUrl === 'string' && /^https?:\/\//.test(supabaseUrl) &&
    typeof supabaseAnon === 'string' && supabaseAnon.length > 20

  if (!hasSupabase) {
    return undefined
  }
  try {
    const supabase = getUserClient()
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
  systemContext?: string,
): Promise<Response> {
  try {
    const { createMastra } = await import('@/mastra')
    const profileUserId = typeof profile?.userId === 'string' ? profile.userId : undefined
    const unifiedContext =
      env.ifsMarkdownContextEnabled && profileUserId ? await loadUnifiedUserContext(profileUserId) : null

    const mastraProfile = {
      ...profile,
      ...(unifiedContext ? { unifiedContext } : {}),
      ...(systemContext ? { inboxContext: systemContext } : {}),
    }

    const mastra = createMastra(mastraProfile)
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

type Method = (...args: unknown[]) => unknown

function getMethod(candidate: unknown, methodName: string): Method | undefined {
  if (!candidate || (typeof candidate !== 'object' && typeof candidate !== 'function')) {
    return undefined
  }
  const value = (candidate as Record<string, unknown>)[methodName]
  return typeof value === 'function' ? (value as Method) : undefined
}

function invokeMethod(candidate: unknown, methodName: string, args: unknown[] = []): unknown | undefined {
  const method = getMethod(candidate, methodName)
  return method ? method.apply(candidate, args) : undefined
}

function asResponse(candidate: unknown): Response | undefined {
  if (!candidate) return undefined
  if (candidate instanceof Response) {
    return candidate
  }
  if (typeof candidate === 'object' && 'body' in candidate && 'headers' in candidate) {
    return candidate as Response
  }
  return undefined
}

export function resolveStreamResponse(candidate: unknown): Response | undefined {
  if (!candidate) return undefined

  const uiMessageStream = tryInvokeResponse(candidate, 'toUIMessageStreamResponse', [{ sendReasoning: false }])
  if (uiMessageStream) return uiMessageStream

  const dataStream = tryInvokeResponse(candidate, 'toDataStreamResponse')
  if (dataStream) return dataStream

  const readable = tryInvokeReadable(candidate)
  if (readable) return readable

  const response = tryInvokeResponse(candidate, 'toResponse') ?? tryInvokeResponse(candidate, 'toStreamResponse')
  if (response) return response

  const direct = asResponse(candidate)
  if (direct) return direct

  return responseFromAsyncIterable(candidate)
}

function tryInvokeReadable(candidate: unknown): Response | undefined {
  const stream = invokeMethod(candidate, 'toReadableStream') as ReadableStream<Uint8Array> | undefined
  if (stream) {
    return new Response(stream, { headers: NO_STORE_HEADERS })
  }

  if (candidate instanceof ReadableStream) {
    return new Response(candidate, { headers: NO_STORE_HEADERS })
  }
  return undefined
}

function tryInvokeResponse(candidate: unknown, methodName: string, args: unknown[] = []): Response | undefined {
  const result = invokeMethod(candidate, methodName, args)
  return asResponse(result)
}

function responseFromAsyncIterable(candidate: unknown): Response | undefined {
  if (!candidate || (typeof candidate !== 'object' && typeof candidate !== 'function')) {
    return undefined
  }
  if (!(Symbol.asyncIterator in (candidate as Record<PropertyKey, unknown>))) {
    return undefined
  }
  const encoder = new TextEncoder()
  const asyncIterable = candidate as AsyncIterable<unknown>
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for await (const chunk of asyncIterable) {
        const text = typeof chunk === 'string' ? chunk : JSON.stringify(chunk)
        controller.enqueue(encoder.encode(text))
      }
      controller.close()
    },
  })
  return new Response(stream, { headers: NO_STORE_HEADERS })
}
