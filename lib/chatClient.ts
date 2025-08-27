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

  let buffer = ''
  const flushSSE = () => {
    // Process complete SSE events: lines starting with "data: " and separated by double newlines
    const events = buffer.split('\n\n')
    // Keep last partial in buffer
    buffer = events.pop() || ''
    for (const ev of events) {
      const lines = ev.split('\n')
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (payload === '[DONE]') {
          params.onChunk('', true)
          return true
        }
        try {
          const obj = JSON.parse(payload)
          const text = extractText(obj)
          if (text) params.onChunk(text, false)
        } catch {
          // Not JSON; treat as raw text
          if (payload) params.onChunk(payload, false)
        }
      }
    }
    return false
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      if (!chunk) continue

      // Heuristic: if it looks like SSE from AI SDK
      if (chunk.includes('data:')) {
        buffer += chunk
        const finished = flushSSE()
        if (finished) return
      } else {
        // Plain text stream
        params.onChunk(chunk, false)
      }
    }
    // Flush any remaining SSE
    if (buffer.length) flushSSE()
    params.onChunk('', true)
  } finally {
    reader.releaseLock()
  }
}

function extractText(obj: any): string {
  let out = ''
  // Prefer explicit AI SDK event shapes
  if (obj && typeof obj === 'object' && typeof (obj as any).type === 'string') {
    const t = (obj as any).type as string
    // include only user-visible deltas, not reasoning
    if (t.includes('text')) {
      const d = (obj as any).delta || (obj as any).text || ''
      if (typeof d === 'string') return d
    }
  }
  const walk = (v: any, k?: string) => {
    if (typeof v === 'string') {
      if (!k || /(text|content|delta)$/i.test(k)) out += v
      return
    }
    if (Array.isArray(v)) {
      for (const item of v) walk(item)
      return
    }
    if (v && typeof v === 'object') {
      for (const [kk, vv] of Object.entries(v)) walk(vv, kk)
    }
  }
  walk(obj)
  return out
}

