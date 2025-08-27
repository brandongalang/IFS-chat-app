import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { messages, profile } = await req.json()

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

    try {
      // Lazy-load the agent only when credentials are available to avoid dev import side-effects
      const { createIfsAgent } = await import('../../../mastra/agents/ifs-agent')
      const ifsAgent = createIfsAgent(profile)

      // Prefer vNext streaming in AI SDK (UI message) format so we can parse consistently on the client
      const agentAny: any = ifsAgent as any
      let stream = null as any
      if (typeof agentAny.streamVNext === 'function') {
        stream = await agentAny.streamVNext(messages, { format: 'aisdk' })
        if (stream && typeof stream.toUIMessageStreamResponse === 'function') {
          return stream.toUIMessageStreamResponse({ sendReasoning: true })
        }
      }
      // Fallback to v2 streaming
      if (!stream && typeof agentAny.stream === 'function') {
        const v2 = await agentAny.stream(messages)
        if (v2 && typeof v2.toDataStreamResponse === 'function') {
          return v2.toDataStreamResponse()
        }
        if (v2 && typeof v2.toReadableStream === 'function') {
          return new Response(v2.toReadableStream(), { headers: { 'Cache-Control': 'no-store' } })
        }
        stream = v2
      }

      // Adapt to the returned stream type
      const anyStream: any = stream as any
      if (anyStream && typeof anyStream.toDataStreamResponse === 'function') {
        return anyStream.toDataStreamResponse()
      }
      if (anyStream && typeof anyStream.toReadableStream === 'function') {
        return new Response(anyStream.toReadableStream(), { headers: { 'Cache-Control': 'no-store' } })
      }
      if (anyStream && typeof anyStream.toResponse === 'function') {
        return anyStream.toResponse()
      }
      if (anyStream && typeof anyStream.toStreamResponse === 'function') {
        return anyStream.toStreamResponse()
      }
      if (anyStream && typeof anyStream === 'object' && 'body' in anyStream && 'headers' in anyStream) {
        // Looks like a web Response
        return anyStream as Response
      }
      if (anyStream && Symbol.asyncIterator in anyStream) {
        // If it's an async iterator of chunks
        const encoder = new TextEncoder()
        const rs = new ReadableStream<Uint8Array>({
          async start(controller) {
            for await (const chunk of anyStream) {
              const text = typeof chunk === 'string' ? chunk : JSON.stringify(chunk)
              controller.enqueue(encoder.encode(text))
            }
            controller.close()
          }
        })
        return new Response(rs, { headers: { 'Cache-Control': 'no-store' } })
      }

      // Fallback: dev stream instead of 500 to keep UI responsive
      console.error('Unsupported stream type from agent. Keys:', typeof anyStream === 'object' ? Object.keys(anyStream) : typeof anyStream)
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