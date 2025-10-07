'use client'

import { useCallback, useRef } from 'react'

export function useChatSession() {
  const sessionIdRef = useRef<string | null>(null)

  const ensureSession = useCallback(async (): Promise<string> => {
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
  }, [])

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
    }
  }, [])

  const clearSession = useCallback(() => {
    sessionIdRef.current = null
  }, [])

  const getSessionId = useCallback(() => sessionIdRef.current, [])

  return { ensureSession, persistMessage, endSession, clearSession, getSessionId }
}
