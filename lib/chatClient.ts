export type BasicMessage = { role: 'user' | 'assistant' | 'system'; content: string }

export async function streamFromMastra(params: {
  messages: BasicMessage[]
  sessionId: string
  userId: string
  onChunk: (chunk: string, done: boolean) => void
  signal?: AbortSignal
}): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Include sessionId and userId for future server-side attribution; the route safely ignores extras
    body: JSON.stringify({ messages: params.messages, sessionId: params.sessionId, userId: params.userId }),
    signal: params.signal,
  })

  if (!res.ok || !res.body) {
    throw new Error(`Failed to start stream (${res.status})`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      if (chunk) params.onChunk(chunk, false)
    }
    params.onChunk('', true)
  } finally {
    reader.releaseLock()
  }
}

