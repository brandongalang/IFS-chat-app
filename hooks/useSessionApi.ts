'use client'

import { useCallback } from 'react'

type StartSessionResponse = {
  sessionId?: string
}

export type PersistMessageArgs = {
  sessionId: string
  role: 'user' | 'assistant'
  content: string
}

export type EndSessionArgs = {
  sessionId: string
}

export function useSessionApi() {
  const startSession = useCallback(async (): Promise<string> => {
    const res = await fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!res.ok) {
      throw new Error('Failed to start session')
    }

    const data = (await res.json()) as StartSessionResponse
    if (!data.sessionId) {
      throw new Error('Session ID missing from response')
    }

    return data.sessionId
  }, [])

  const persistMessage = useCallback(
    async ({ sessionId, role, content }: PersistMessageArgs): Promise<void> => {
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

  const endSession = useCallback(async ({ sessionId }: EndSessionArgs): Promise<void> => {
    const res = await fetch('/api/session/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })

    if (!res.ok) {
      throw new Error('Failed to end session')
    }
  }, [])

  return { startSession, persistMessage, endSession }
}
