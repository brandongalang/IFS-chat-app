export type BasicMessage = { role: 'user' | 'assistant' | 'system'; content: string }

export type Profile = { name: string; bio: string }

import type { TaskEvent } from '@/types/chat'

export async function streamFromMastra(params: {
  messages: BasicMessage[]
  sessionId: string
  userId: string
  profile: Profile
  onChunk: (chunk: string, done: boolean) => void
  onTask?: (event: TaskEvent) => void
  apiPath?: string
  signal?: AbortSignal
}): Promise<void> {
  const apiPath = params.apiPath ?? '/api/chat'
  const res = await fetch(apiPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Include sessionId and userId for future server-side attribution; the route safely ignores extras
    body: JSON.stringify({
      messages: params.messages,
      sessionId: params.sessionId,
      userId: params.userId,
      profile: params.profile,
    }),
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
          // Handle UI message stream events for tasks and text
          if (obj && typeof obj === 'object' && typeof obj.type === 'string') {
            const handled = handleUiEvent(obj, params.onTask)
            if (handled) {
              // task or non-text UI event handled
            } else {
              const text = extractText(obj)
              if (text) params.onChunk(text, false)
            }
          } else {
            const text = extractText(obj)
            if (text) params.onChunk(text, false)
          }
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

function statusFromState(state?: string): TaskEvent['status'] | undefined {
  switch (state) {
    case 'input-streaming':
    case 'input-available':
      return 'working'
    case 'output-available':
      return 'completed'
    case 'output-error':
      return 'failed'
    default:
      return undefined
  }
}

function handleUiEvent(obj: any, onTask?: (e: TaskEvent) => void): boolean {
  if (!onTask) return false
  const t = String(obj.type || '')

  // Ignore any explicit reasoning types defensively
  if (t.includes('reasoning')) return true

  // start-step / finish-step
  if (t === 'start-step') {
    const ev: TaskEvent = {
      id: String(obj.id || obj.name || Math.random().toString(36).slice(2)),
      title: String(obj.name || 'Step'),
      status: 'working',
    }
    onTask(ev)
    return true
  }
  if (t === 'finish-step') {
    const ev: TaskEvent = {
      id: String(obj.id || Math.random().toString(36).slice(2)),
      title: String(obj.name || 'Step'),
      status: (obj.status as TaskEvent['status']) || 'completed',
    }
    onTask(ev)
    return true
  }

  // tool-* events from UI stream
  if (t.startsWith('tool-')) {
    const name = t.replace(/^tool-/, '') || 'tool'
    const st = statusFromState(obj.state)
    if (!st) return true
    const ev: TaskEvent = {
      id: String(obj.toolCallId || name),
      title: name,
      status: st,
      meta: { input: obj.input, output: obj.output, providerExecuted: obj.providerExecuted },
    }
    onTask(ev)
    return true
  }

  // generic dev-only data-task
  if (t === 'data-task' || t === 'task') {
    const ev: TaskEvent = {
      id: String(obj.id || Math.random().toString(36).slice(2)),
      title: String(obj.title || 'Task'),
      status: (obj.status as TaskEvent['status']) || 'working',
      progress: typeof obj.progress === 'number' ? obj.progress : undefined,
      details: obj.details,
      meta: obj.meta,
    }
    onTask(ev)
    return true
  }

  return false
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

