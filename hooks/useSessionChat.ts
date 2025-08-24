'use client'

import { useChat } from '@ai-sdk/react'
import { useState, useEffect } from 'react'

export function useSessionChat() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [userId] = useState(
    process.env.NEXT_PUBLIC_IFS_DEFAULT_USER_ID ||
    (process as any).env?.PUBLIC_IFS_DEFAULT_USER_ID ||
    (process as any).env?.VITE_IFS_DEFAULT_USER_ID ||
    'default-user'
  )
  const [localInput, setLocalInput] = useState('')
  const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  async function getChatSessionService() {
    const mod = await import('../lib/session-service')
    return mod.chatSessionService
  }

  const chatResult = useChat({
    api: '/api/chat/ui',
    onFinish: async (message: any) => {
      // Persist only visible text for now; ignore reasoning in logs
      const textFromParts = Array.isArray(message?.parts)
        ? message.parts
            .filter((p: any) => p?.type === 'text' && typeof p?.text === 'string')
            .map((p: any) => p.text)
            .join('\n')
        : undefined

      const contentToSave = textFromParts || (message as any)?.content || ''

      if (hasSupabase && sessionId && contentToSave) {
        const chatSessionService = await getChatSessionService()
        await chatSessionService.addMessage(sessionId, {
          role: 'assistant',
          content: contentToSave,
        })
      }
    },
  })

  // Debug logging
  useEffect(() => {
    console.log('useChat result:', {
      hasInput: chatResult.input !== undefined,
      hasHandleInputChange: typeof chatResult.handleInputChange === 'function',
      hasMessages: Array.isArray(chatResult.messages),
      error: chatResult.error
    })
  }, [chatResult])

  // Fallback input handling if useChat fails
  const input = chatResult.input !== undefined ? chatResult.input : localInput
  const handleInputChange = chatResult.handleInputChange || ((e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('Using fallback input handler')
    setLocalInput(e.target.value)
  })

  // Initialize session when component mounts
  useEffect(() => {
    const initSession = async () => {
      try {
        const response = await fetch('/api/session/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to start session')
        }

        const { sessionId: newSessionId } = await response.json()
        setSessionId(newSessionId)

      } catch (error) {
        console.error('Failed to start session:', error)
      }
    }
    
    initSession()
  }, [userId])

  const customHandleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    // Save user message to session before sending
    if (hasSupabase && sessionId && input?.trim()) {
      const chatSessionService = await getChatSessionService()
      await chatSessionService.addMessage(sessionId, {
        role: 'user',
        content: input.trim()
      })
    }
    
    // If the hook manages input internally, use its submit; else send manually
    if (chatResult.handleSubmit && chatResult.input !== undefined) {
      chatResult.handleSubmit(e)
    } else if (input?.trim()) {
      try {
        await chatResult.append({ role: 'user', content: input.trim() })
        setLocalInput('')
      } catch (err) {
        console.error('Failed to send message:', err)
      }
    }
  }

  return {
    messages: chatResult.messages || [],
    input,
    handleInputChange,
    handleSubmit: customHandleSubmit,
    isLoading: chatResult.isLoading || false,
    status: (chatResult as any).status,
    error: chatResult.error,
    reload: chatResult.reload,
    stop: chatResult.stop,
    append: chatResult.append,
    setMessages: chatResult.setMessages,
    sessionId,
  }
}
