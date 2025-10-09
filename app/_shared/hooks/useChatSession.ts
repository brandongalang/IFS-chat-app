'use client'

import { useCallback, useRef } from 'react'

const PREFLIGHT_TIMEOUT_MS = 8000

export function useChatSession() {
  const sessionIdRef = useRef<string | null>(null)
  const preflightRanRef = useRef(false)

  const runPreflight = useCallback(async () => {
    if (preflightRanRef.current) return

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined
    const timeoutId = controller ? setTimeout(() => controller.abort(), PREFLIGHT_TIMEOUT_MS) : null
    preflightRanRef.current = true

    try {
      const response = await fetch('/api/memory/preflight', {
        method: 'POST',
        signal: controller?.signal,
      })

      if (!response.ok) {
        throw new Error(`Preflight summarization failed with status ${response.status}`)
      }
    } catch (error) {
      preflightRanRef.current = false
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.warn('[chat] memory preflight aborted due to timeout')
        return
      }
      console.warn('[chat] memory preflight failed', error)
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  const ensureSession = useCallback(async (): Promise<string> => {
    await runPreflight()

    if (sessionIdRef.current) return sessionIdRef.current

    const res = await fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!res.ok) {
      throw new Error('Failed to start session')
    }

    const data = await res.json()
    sessionIdRef.current = data.sessionId
    return data.sessionId
  }, [runPreflight])

  const persistMessage = useCallback(
    async (sessionId: string, role: 'user' | 'assistant', content: string) => {
      const res = await fetch('/api/session/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, role, content }),
      })

      if (!res.ok) {
        throw new Error('Failed to persist message')
      }
    },
    [],
  )

  const endSession = useCallback(async () => {
    const id = sessionIdRef.current
    if (!id) return

    try {
      await fetch('/api/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id }),
      })
    } finally {
      sessionIdRef.current = null
      preflightRanRef.current = false
    }
  }, [])

  const clearSession = useCallback(() => {
    sessionIdRef.current = null
    preflightRanRef.current = false
  }, [])

  const getSessionId = useCallback(() => sessionIdRef.current, [])

  return { ensureSession, persistMessage, endSession, clearSession, getSessionId }
}
