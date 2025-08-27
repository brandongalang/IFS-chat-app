'use client'

/**
 * Removed: useSessionChat
 * This hook is no longer supported. Use useChat from '@/hooks/useChat', which
 * streams to the unified /api/chat endpoint and persists messages via /api/session/*.
 */
export function useSessionChat(): never {
  throw new Error(
    "useSessionChat has been removed. Use useChat from '@/hooks/useChat' and the unified /api/chat endpoint."
  )
}
