import { NextRequest } from 'next/server'
import { ifsAgent } from '../../../mastra/agents/ifs-agent'

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get streaming response from IFS agent using Mastra's stream API
    const stream = await ifsAgent.stream(messages)

    // Return the stream response directly - Mastra handles the streaming format
    return stream.toDataStreamResponse()

  } catch (error) {
    console.error('Chat API error:', error)
    return new Response(JSON.stringify({ error: 'Something went wrong' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}