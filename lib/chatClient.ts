export type BasicMessage = { role: 'user' | 'assistant' | 'system'; content: string }

export type Profile = { name: string; bio: string }

import type { TaskEvent, TaskEventUpdate } from '@/types/chat'

export async function streamFromMastra(params: {
  messages: BasicMessage[]
  sessionId: string
  profile: Profile
  onChunk: (chunk: string, done: boolean) => void
  onTask?: (event: TaskEventUpdate) => void
  apiPath?: string
  signal?: AbortSignal
}): Promise<void> {
  const apiPath = params.apiPath ?? '/api/chat'
  const res = await fetch(apiPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Include sessionId for future server-side attribution; the route safely ignores extras
    body: JSON.stringify({
      messages: params.messages,
      sessionId: params.sessionId,
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
          const objUnknown: unknown = JSON.parse(payload)
          // Handle UI message stream events for tasks and text
          if (isObjectWithType(objUnknown)) {
            const handled = handleUiEvent(objUnknown, params.onTask)
            if (!handled) {
              const text = extractText(objUnknown)
              if (text) params.onChunk(text, false)
            }
          } else {
            const text = extractText(objUnknown)
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


function handleUiEvent(obj: unknown, onTask?: (e: TaskEventUpdate) => void): boolean {
  if (!onTask) return false
  if (!isObject(obj)) return false
  const o = obj as Record<string, unknown>
  const t = String(o.type ?? '')

  // Ignore any explicit reasoning types defensively
  if (t.includes('reasoning')) return true

  // start-step / finish-step
  if (t === 'start-step') {
    const ev: TaskEvent = {
      id: String(o.id ?? o.name ?? Math.random().toString(36).slice(2)),
      title: String(o.name ?? 'Step'),
      status: 'working',
    }
    onTask(ev)
    return true
  }
  if (t === 'finish-step') {
    const ev: TaskEvent = {
      id: String(o.id ?? Math.random().toString(36).slice(2)),
      title: String(o.name ?? 'Step'),
      status: (o.status as TaskEvent['status']) ?? 'completed',
    }
    onTask(ev)
    return true
  }

  if (t === 'update-task' || t === 'task-update' || t === 'task-progress') {
    const ev: TaskEventUpdate = {
      id: String(o.id ?? o.taskId ?? o.name ?? Math.random().toString(36).slice(2)),
    }

    const title =
      typeof o.title === 'string'
        ? o.title
        : typeof o.name === 'string'
        ? o.name
        : undefined
    if (title) ev.title = title

    const status =
      (o.status as TaskEvent['status']) ??
      statusFromState(o.state as string | undefined)
    if (status) ev.status = status

    const progress = parseProgressValue(
      'progress' in o
        ? o.progress
        : 'percent' in o
        ? o.percent
        : 'percentage' in o
        ? o.percentage
        : 'value' in o
        ? o.value
        : undefined,
    )
    if (progress !== undefined) ev.progress = progress

    const details = parseDetailsValue(
      'details' in o
        ? o.details
        : 'detail' in o
        ? o.detail
        : 'message' in o
        ? o.message
        : 'text' in o
        ? o.text
        : 'delta' in o
        ? o.delta
        : undefined,
    )
    if (details !== undefined) ev.details = details

    const meta = parseTaskMeta(o.meta, o.files)
    if (meta !== undefined) ev.meta = meta

    onTask(ev)
    return true
  }

  // tool-* events from UI stream
  if (t.startsWith('tool-')) {
    const name = t.replace(/^tool-/, '') || 'tool'
    const st = statusFromState(o.state as string | undefined)
    if (!st) return true
    const ev: TaskEvent = {
      id: String(o.toolCallId ?? name),
      title: name,
      status: st,
      meta: { input: o.input, output: o.output, providerExecuted: o.providerExecuted },
    }
    onTask(ev)
    return true
  }

  // generic dev-only data-task
  if (t === 'data-task' || t === 'task') {
    const progress = parseProgressValue(
      'progress' in o ? o.progress : 'percent' in o ? o.percent : undefined,
    )
    const details = parseDetailsValue(
      'details' in o
        ? o.details
        : 'detail' in o
        ? o.detail
        : 'message' in o
        ? o.message
        : 'delta' in o
        ? o.delta
        : undefined,
    )
    const meta = parseTaskMeta(o.meta, o.files)
    const ev: TaskEvent = {
      id: String(o.id ?? Math.random().toString(36).slice(2)),
      title: String(o.title ?? o.name ?? 'Task'),
      status:
        (o.status as TaskEvent['status']) ??
        statusFromState(o.state as string | undefined) ??
        'working',
      ...(progress !== undefined ? { progress } : {}),
      ...(details !== undefined ? { details } : {}),
      ...(meta ? { meta } : {}),
    }
    onTask(ev)
    return true
  }

  return false
}

function parseProgressValue(value: unknown): number | undefined {
  const num =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
      ? Number(value)
      : undefined
  if (num === undefined || Number.isNaN(num) || !Number.isFinite(num)) return undefined
  let normalized = num
  if (normalized > 0 && normalized <= 1) {
    normalized *= 100
  }
  if (normalized < 0) normalized = 0
  if (normalized > 100) normalized = 100
  return normalized
}

function parseDetailsValue(value: unknown): string | string[] | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => {
        if (typeof item === 'string') return item
        if (typeof item === 'number' || typeof item === 'boolean') return String(item)
        if (isObject(item) && typeof (item as Record<string, unknown>).text === 'string') {
          return String((item as Record<string, unknown>).text)
        }
        return undefined
      })
      .filter((item): item is string => typeof item === 'string' && item.length > 0)
    return normalized.length ? normalized : undefined
  }
  if (isObject(value)) {
    const record = value as Record<string, unknown>
    if (typeof record.message === 'string') return record.message
    if (typeof record.text === 'string') return record.text
  }
  return undefined
}

function parseTaskMeta(metaCandidate: unknown, filesCandidate?: unknown): TaskEvent['meta'] | undefined {
  let meta: TaskEvent['meta'] | undefined
  if (isObject(metaCandidate)) {
    meta = metaCandidate as TaskEvent['meta']
  }
  if (Array.isArray(filesCandidate)) {
    const files = filesCandidate
      .map((file) => {
        if (isObject(file) && typeof (file as Record<string, unknown>).name === 'string') {
          return { name: String((file as Record<string, unknown>).name) }
        }
        if (typeof file === 'string' || typeof file === 'number' || typeof file === 'boolean') {
          return { name: String(file) }
        }
        return undefined
      })
      .filter((file): file is { name: string } => Boolean(file))
    if (files.length) {
      meta = { ...(meta ?? {}), files }
    }
  }
  return meta
}

function extractText(obj: unknown): string {
  let out = ''
  // Prefer explicit AI SDK event shapes
  if (isObject(obj) && typeof (obj as Record<string, unknown>).type === 'string') {
    const t = String((obj as Record<string, unknown>).type)
    // include only user-visible deltas, not reasoning
    if (t.includes('text')) {
      const d = (obj as Record<string, unknown>).delta ?? (obj as Record<string, unknown>).text ?? ''
      if (typeof d === 'string') return d
    }
  }
  const walk = (v: unknown, k?: string) => {
    if (typeof v === 'string') {
      if (!k || /(text|content|delta)$/i.test(k)) out += v
      return
    }
    if (Array.isArray(v)) {
      for (const item of v) walk(item)
      return
    }
    if (isObject(v)) {
      for (const [kk, vv] of Object.entries(v)) walk(vv, kk)
    }
  }
  walk(obj)
  return out
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isObjectWithType(value: unknown): value is Record<string, unknown> & { type: string } {
  return isObject(value) && typeof (value as Record<string, unknown>).type === 'string'
}

