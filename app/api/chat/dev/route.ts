import { simulateReadableStream } from 'ai'

export const maxDuration = 60

export async function POST() {
  const chunks: string[] = [
    `data: ${JSON.stringify({ type: 'start', messageId: 'msg-dev-1' })}\n\n`,
    // Planning / Writing / Formatting as non-reasoning steps
    `data: ${JSON.stringify({ type: 'start-step', id: 'task-planning', name: 'Planning' })}\n\n`,
    `data: ${JSON.stringify({ type: 'start-step', id: 'task-writing', name: 'Writing' })}\n\n`,
    // Simulate a tool step using tool-* states
    `data: ${JSON.stringify({ type: 'tool-search', toolCallId: 'tool-1', state: 'input-available', input: { query: 'example query' } })}\n\n`,
    `data: ${JSON.stringify({ type: 'tool-search', toolCallId: 'tool-1', state: 'output-available', input: { query: 'example query' }, output: { items: 2 } })}\n\n`,
    // Finish steps
    `data: ${JSON.stringify({ type: 'finish-step', id: 'task-planning', status: 'completed' })}\n\n`,
    `data: ${JSON.stringify({ type: 'start-step', id: 'task-formatting', name: 'Formatting' })}\n\n`,
    `data: ${JSON.stringify({ type: 'finish-step', id: 'task-writing', status: 'completed' })}\n\n`,
    `data: ${JSON.stringify({ type: 'finish-step', id: 'task-formatting', status: 'completed' })}\n\n`,
    // Stream assistant text
    `data: ${JSON.stringify({ type: 'text-start', id: 'text-1' })}\n\n`,
    `data: ${JSON.stringify({ type: 'text-delta', id: 'text-1', delta: 'Here is a simulated answer for dev mode. ' })}\n\n`,
    `data: ${JSON.stringify({ type: 'text-delta', id: 'text-1', delta: 'It includes task steps without reasoning.' })}\n\n`,
    `data: ${JSON.stringify({ type: 'text-end', id: 'text-1' })}\n\n`,
    `data: ${JSON.stringify({ type: 'finish' })}\n\n`,
    `data: [DONE]\n\n`,
  ]

  const stream = simulateReadableStream({
    initialDelayInMs: 200,
    chunkDelayInMs: 200,
    chunks,
  }).pipeThrough(new TextEncoderStream())

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

