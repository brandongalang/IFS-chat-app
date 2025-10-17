import { env } from '@/config/env'
import { loadOverviewSnapshot } from '@/lib/memory/overview'
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

/**
 * Provide a dev-friendly fallback stream that matches the Vercel AI SDK
 * UI message stream format. This ensures the client hook (@ai-sdk/react useChat)
 * can render messages even when real providers/agents are unavailable.
 */
export function provideDevFallbackStream(text: string): Response {
  const deltaSize = 24
  const deltas: string[] = []
  for (let i = 0; i < text.length; i += deltaSize) {
    deltas.push(text.slice(i, i + deltaSize))
  }

  const encoder = new TextEncoder()
  const chunks: string[] = [
    `data: ${JSON.stringify({ type: 'start', messageId: `msg-dev-${Date.now()}` })}\n\n`,
    `data: ${JSON.stringify({ type: 'start-step', id: 'dev-writing', name: 'writing' })}\n\n`,
    `data: ${JSON.stringify({ type: 'text-start', id: 'text-1' })}\n\n`,
    ...deltas.map((d) => `data: ${JSON.stringify({ type: 'text-delta', id: 'text-1', delta: d })}\n\n`),
    `data: ${JSON.stringify({ type: 'text-end', id: 'text-1' })}\n\n`,
    `data: ${JSON.stringify({ type: 'finish-step', id: 'dev-writing', status: 'completed' })}\n\n`,
    `data: ${JSON.stringify({ type: 'finish' })}\n\n`,
    `data: [DONE]\n\n`,
  ]

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let i = 0
      const pump = () => {
        if (i >= chunks.length) {
          controller.close()
          return
        }
        controller.enqueue(encoder.encode(chunks[i++]))
        // Gentle pacing for UX parity with dev route
        setTimeout(pump, 120)
      }
      pump()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'x-vercel-ai-ui-message-stream': 'v1',
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
    const overviewSnapshot =
      env.ifsMarkdownContextEnabled && profileUserId ? await loadOverviewSnapshot(profileUserId) : null

    const mastraProfile = {
      ...profile,
      ...(overviewSnapshot ? { overviewSnapshot } : {}),
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
