'use client'

import { useCallback, useRef } from 'react'
import { useSessionApi } from './useSessionApi'

export function useChatSession() {
  const sessionIdRef = useRef<string | null>(null)
  const { startSession, persistMessage: persistSessionMessage, endSession: endSessionApi } = useSessionApi()

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionIdRef.current) return sessionIdRef.current

    const sessionId = await startSession()
    sessionIdRef.current = sessionId
    return sessionId
  }, [startSession])

  const persistMessage = useCallback(
    async (sessionId: string, role: 'user' | 'assistant', content: string) => {
      await persistSessionMessage({ sessionId, role, content })
    },
    [persistSessionMessage],
  )

  const endSession = useCallback(async () => {
    const id = sessionIdRef.current
    if (!id) return

    try {
      await endSessionApi({ sessionId: id })
    } finally {
      sessionIdRef.current = null
    }
  }, [endSessionApi])

  const clearSession = useCallback(() => {
    sessionIdRef.current = null
  }, [])

  const getSessionId = useCallback(() => sessionIdRef.current, [])

  return { ensureSession, persistMessage, endSession, clearSession, getSessionId }
}
