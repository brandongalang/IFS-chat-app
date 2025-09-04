import { simulateReadableStream } from 'ai'

export const maxDuration = 60

export async function POST() {
  const text =
    'here is a simulated answer for dev mode. it should stream in slowly and fade each letter so you can evaluate the ethereal pacing and typography. '
    + 'this stream is intentionally long to demonstrate the animation and throttled updates across multiple chunks. '
    + 'if this looks good, we can tweak speed and easing to taste.'

  const deltaSize = 12
  const deltas: string[] = []
  for (let i = 0; i < text.length; i += deltaSize) {
    deltas.push(text.slice(i, i + deltaSize))
  }

  const chunks: string[] = [
    `data: ${JSON.stringify({ type: 'start', messageId: 'msg-dev-1' })}\n\n`,
    // Minimal step scaffolding
    `data: ${JSON.stringify({ type: 'start-step', id: 'task-writing', name: 'writing' })}\n\n`,
    `data: ${JSON.stringify({ type: 'text-start', id: 'text-1' })}\n\n`,
    ...deltas.map((d) => `data: ${JSON.stringify({ type: 'text-delta', id: 'text-1', delta: d })}\n\n`),
    `data: ${JSON.stringify({ type: 'text-end', id: 'text-1' })}\n\n`,
    `data: ${JSON.stringify({ type: 'finish-step', id: 'task-writing', status: 'completed' })}\n\n`,
    `data: ${JSON.stringify({ type: 'finish' })}\n\n`,
    `data: [DONE]\n\n`,
  ]

  const stream = simulateReadableStream({
    initialDelayInMs: 100,
    chunkDelayInMs: 100,
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
