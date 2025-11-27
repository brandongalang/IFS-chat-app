import { useState, useCallback, useRef } from 'react'

export interface StreamEvent {
  event: string
  data: Record<string, unknown>
  timestamp: number
}

export interface UseInboxGenerateStreamReturn {
  events: StreamEvent[]
  isStreaming: boolean
  error: string | null
  startStream: () => Promise<void>
  clearEvents: () => void
}

export function useInboxGenerateStream(): UseInboxGenerateStreamReturn {
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const startStream = useCallback(async () => {
    // Abort any existing stream
    if (abortRef.current) {
      abortRef.current.abort()
    }

    setEvents([])
    setError(null)
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/api/inbox/generate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE events from buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        let currentEvent = ''
        let currentData = ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7)
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6)
            if (currentEvent && currentData) {
              try {
                const data = JSON.parse(currentData)
                setEvents((prev) => [
                  ...prev,
                  { event: currentEvent, data, timestamp: Date.now() },
                ])
              } catch {
                // Skip malformed JSON
              }
              currentEvent = ''
              currentData = ''
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Intentional abort, not an error
        return
      }
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [])

  const clearEvents = useCallback(() => {
    setEvents([])
    setError(null)
  }, [])

  return {
    events,
    isStreaming,
    error,
    startStream,
    clearEvents,
  }
}
