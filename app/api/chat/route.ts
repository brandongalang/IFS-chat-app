import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // If no OpenRouter credentials, provide a dev fallback text stream so the UI works
    const hasOpenrouter = typeof process.env.OPENROUTER_API_KEY === 'string' && process.env.OPENROUTER_API_KEY.length > 10
    const allowAgent = hasOpenrouter && process.env.NODE_ENV === 'production'
    if (!allowAgent) {
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
      const { ifsAgent } = await import('../../../mastra/agents/ifs-agent')

      // Use streamVNext when available; otherwise fallback to stream
      const agentAny: any = ifsAgent as any
      const stream = typeof agentAny.streamVNext === 'function'
        ? await agentAny.streamVNext(messages)
        : await agentAny.stream(messages)

      // Adapt to the returned stream type
      if (stream && typeof stream.toDataStreamResponse === 'function') {
        return stream.toDataStreamResponse()
      }
      if (stream && typeof stream.toReadableStream === 'function') {
        return new Response(stream.toReadableStream(), { headers: { 'Cache-Control': 'no-store' } })
      }
      if (stream && Symbol.asyncIterator in stream) {
        // If it's an async iterator of chunks
        const encoder = new TextEncoder()
        const rs = new ReadableStream<Uint8Array>({
          async start(controller) {
            for await (const chunk of stream) {
              const text = typeof chunk === 'string' ? chunk : JSON.stringify(chunk)
              controller.enqueue(encoder.encode(text))
            }
            controller.close()
          }
        })
        return new Response(rs, { headers: { 'Cache-Control': 'no-store' } })
      }

      // Fallback: serialize to JSON
      return new Response(JSON.stringify({ error: 'Unsupported stream type' }), { status: 500 })
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