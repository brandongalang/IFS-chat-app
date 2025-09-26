'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { UIMessage } from 'ai'
import { DefaultChatTransport } from 'ai'
import { useChat as useAiChat } from '@ai-sdk/react'
import { useSearchParams } from 'next/navigation'

import { useChatSession } from './useChatSession'
import { useToast } from './use-toast'
import { useUser } from '@/context/UserContext'
import { getPartById } from '@/lib/data/parts-lite'
import type { Message, TaskEvent, TaskEventUpdate } from '@/types/chat'

interface ChatHookReturn {
  messages: Message[]
  input: string
  setInput: Dispatch<SetStateAction<string>>
  handleSubmit: (event?: FormEvent<HTMLFormElement> | { preventDefault?: () => void }) => void
  isLoading: boolean
  currentStreamingId?: string
  hasActiveSession: boolean
  tasksByMessage: Record<string, TaskEvent[]>
  sendMessage: (content: string) => Promise<void>
  addAssistantMessage: (content: string, opts?: { persist?: boolean; id?: string; persona?: 'claude' | 'default' }) => Promise<void>
  clearChat: () => void
  endSession: () => Promise<void>
  sendFeedback: (messageId: string, rating: 'thumb_up' | 'thumb_down', explanation?: string) => Promise<void>
  needsAuth: boolean
  authLoading: boolean
  error?: Error
}

function extractText(message: UIMessage): string {
  if (!Array.isArray(message.parts)) return ''
  return message.parts
    .map((part) => {
      if (part?.type === 'text') return part.text ?? ''

      if (typeof part?.type === 'string' && part.type.startsWith('tool-')) {
        const output = (part as { output?: unknown }).output
        return typeof output === 'string' ? output : ''
      }

      if (typeof part?.type === 'string' && part.type.startsWith('data-')) {
        const data = (part as { data?: unknown }).data
        return typeof data === 'string' ? data : ''
      }

      return ''
    })
    .join('')
    .trim()
}

const messageTimestamps: Record<string, number> = {}

function toBasicMessage(message: UIMessage, isStreaming: boolean): Message {
  if (!messageTimestamps[message.id]) {
    messageTimestamps[message.id] = Date.now()
  }
  return {
    id: message.id,
    role: message.role === 'assistant' || message.role === 'system' ? 'assistant' : 'user',
    content: extractText(message),
    timestamp: messageTimestamps[message.id],
    persona: message.role === 'assistant' ? 'claude' : undefined,
    streaming: message.role === 'assistant' && isStreaming,
    tasks: [],
  }
}

function resetMessageTimestamps() {
  for (const key of Object.keys(messageTimestamps)) {
    delete messageTimestamps[key]
  }
}

export function useChat(): ChatHookReturn {
  const searchParams = useSearchParams()
  const { profile, loading: authLoading } = useUser()
  const needsAuth = !authLoading && !profile
  const { toast } = useToast()
  const {
    ensureSession: ensureSessionRaw,
    persistMessage,
    endSession: endSessionRaw,
    clearSession,
    getSessionId,
  } = useChatSession()

  const [hasActiveSession, setHasActiveSession] = useState<boolean>(Boolean(getSessionId()))
  const [sessionId, setSessionId] = useState<string | null>(getSessionId())
  const [tasksByMessage, setTasksByMessage] = useState<Record<string, TaskEvent[]>>({})

  const chatTransport = useMemo(() => new DefaultChatTransport({ api: '/api/chat' }), [])

  const {
    messages: uiMessages,
    setMessages,
    sendMessage: sdkSendMessage,
    status,
    stop,
    error,
  } = useAiChat({
    transport: chatTransport,
    onError(error) {
      console.error('Chat stream error:', error)
      toast({
        title: 'Stream failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    },
    async onFinish({ message }) {
      if (message.role === 'assistant' && sessionId) {
        const text = extractText(message)
        if (text) {
          persistMessage(sessionId, 'assistant', text).catch(() => {})
        }
      }
    },
  })

  const ensureSession = useCallback(async () => {
    if (needsAuth) {
      const error = new Error('Authentication required')
      toast({ title: 'Session failed', description: error.message, variant: 'destructive' })
      throw error
    }
    try {
      const id = await ensureSessionRaw()
      setSessionId(id)
      setHasActiveSession(true)
      return id
    } catch (error: unknown) {
      throw error
    }
  }, [ensureSessionRaw, needsAuth, toast])

  const [input, setInput] = useState('')

  const isLoading = status === 'submitted' || status === 'streaming'

  const currentStreamingId = useMemo(() => {
    if (status !== 'streaming') return undefined
    const lastAssistant = [...uiMessages].reverse().find((msg) => msg.role === 'assistant')
    return lastAssistant?.id
  }, [status, uiMessages])

  const derivedMessages = useMemo(
    () => uiMessages.map((msg) => toBasicMessage(msg, currentStreamingId === msg.id)),
    [currentStreamingId, uiMessages],
  )

  const seededRef = useRef(false)
  const processedTaskParts = useRef<Record<string, number>>({})

  useEffect(() => {
    const partId = searchParams.get('partId')
    if (!partId || seededRef.current || derivedMessages.length > 0 || needsAuth) return

    const fetchPartAndStart = async () => {
      try {
        const part = await getPartById({ partId })
        if (part) {
          const partName = part.name ?? 'part'
          const message: UIMessage = {
            id: `seed-${partId}`,
            role: 'assistant',
            parts: [
              {
                type: 'text',
                text: `Let's talk about your "${partName}" part. What's on your mind regarding it?`,
              },
            ],
          }
          setMessages([message])
        }
      } catch {
        // ignore
      }
    }

    seededRef.current = true
    void fetchPartAndStart()
  }, [derivedMessages.length, needsAuth, searchParams, setMessages])

  const upsertTaskForMessage = useCallback((messageId: string, evt: TaskEventUpdate) => {
    setTasksByMessage((prev) => {
      const list = prev[messageId] ?? []
      const idx = list.findIndex((task) => task.id === evt.id)

      const mergeTask = (current: TaskEvent | undefined, update: TaskEventUpdate): TaskEvent => {
        const base: TaskEvent = current
          ? { ...current }
          : {
              id: update.id,
              title: update.title ?? 'Task',
              status: update.status ?? 'working',
            }

        if (update.title !== undefined) base.title = update.title
        if (update.status !== undefined) base.status = update.status
        if ('progress' in update) base.progress = update.progress
        if ('details' in update) base.details = update.details
        if ('meta' in update) {
          base.meta = update.meta ? { ...(current?.meta ?? {}), ...update.meta } : undefined
        }

        return base
      }

      const nextList = idx >= 0 ? list.map((task, i) => (i === idx ? mergeTask(task, evt) : task)) : [...list, mergeTask(undefined, evt)]
      return { ...prev, [messageId]: nextList }
    })
  }, [])

  const addAssistantMessage = useCallback<ChatHookReturn['addAssistantMessage']>(
    async (content, opts) => {
      if (needsAuth || !content) return
      const id = opts?.id ?? `assistant-${Math.random().toString(36).slice(2)}`
      setMessages((prev) => [
        ...prev,
        {
          id,
          role: 'assistant',
          parts: [{ type: 'text', text: content }],
        },
      ])

      if (opts?.persist) {
        try {
          const id = await ensureSession()
          await persistMessage(id, 'assistant', content)
        } catch {
          // persistence errors already surfaced via toast
        }
      }
    },
    [ensureSession, needsAuth, persistMessage, setMessages],
  )

  const sendMessage = useCallback<ChatHookReturn['sendMessage']>(
    async (content) => {
      const trimmed = content.trim()
      if (!trimmed || authLoading || needsAuth) return

      if (status === 'streaming') {
        await stop()
      }

      let id = sessionId
      try {
        id = await ensureSession()
      } catch (error) {
        console.error('Failed to start session:', error)
        return
      }

      if (id) {
        persistMessage(id, 'user', trimmed).catch(() => {})
      }

      await sdkSendMessage(
        { text: trimmed },
        {
          headers: id ? { 'x-session-id': id } : undefined,
          body: {
            profile: profile ?? { name: '', bio: '' },
          },
        },
      )
    },
    [authLoading, ensureSession, needsAuth, persistMessage, profile, sdkSendMessage, sessionId, status, stop],
  )

  const clearChat = useCallback(() => {
    void stop()
    setMessages([])
    setTasksByMessage({})
    processedTaskParts.current = {}
    resetMessageTimestamps()
  }, [setMessages, stop])

  const endSession = useCallback(async () => {
    if (needsAuth) {
      clearChat()
      setSessionId(null)
      setHasActiveSession(false)
      clearSession()
      return
    }

    try {
      await endSessionRaw()
    } finally {
      clearChat()
      setSessionId(null)
      setHasActiveSession(false)
      clearSession()
    }
  }, [clearChat, clearSession, endSessionRaw, needsAuth])

  const sendFeedback = useCallback<ChatHookReturn['sendFeedback']>(
    async (messageId, rating, explanation) => {
      if (needsAuth) return
      const id = sessionId ?? getSessionId()
      if (!id) {
        toast({
          title: 'Error',
          description: 'No active session to submit feedback for.',
          variant: 'destructive',
        })
        return
      }

      try {
        const res = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: id, messageId, rating, explanation }),
        })

        if (!res.ok) {
          throw new Error('Failed to submit feedback')
        }

        toast({ title: 'Feedback submitted', description: 'Thank you for your feedback!' })
      } catch (error) {
        console.error('Error submitting feedback:', error)
        toast({
          title: 'Error',
          description: 'Could not submit feedback. Please try again later.',
          variant: 'destructive',
        })
      }
    },
    [getSessionId, needsAuth, sessionId, toast],
  )

  useEffect(() => {
    uiMessages.forEach((message) => {
      if (!Array.isArray(message.parts) || message.parts.length === 0) return
      const partCount = message.parts.length
      if (processedTaskParts.current[message.id] === partCount) return

      processedTaskParts.current[message.id] = partCount

      message.parts.forEach((part) => {
        if (typeof part?.type !== 'string' || !part.type.startsWith('data-')) return
        const data = (part as { data?: unknown }).data
        if (data && typeof data === 'object' && 'taskUpdate' in data) {
          const update = (data as { taskUpdate: TaskEventUpdate }).taskUpdate
          upsertTaskForMessage(message.id, update)
        }
      })
    })
  }, [uiMessages, upsertTaskForMessage])

  const handleSubmit = useCallback<ChatHookReturn['handleSubmit']>(
    (event) => {
      event?.preventDefault?.()
      const currentInput = input.trim()
      if (!currentInput || isLoading) return

      setInput('')
      void sendMessage(currentInput)
    },
    [input, isLoading, sendMessage],
  )

  return {
    messages: derivedMessages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    currentStreamingId,
    hasActiveSession,
    tasksByMessage,
    sendMessage,
    addAssistantMessage,
    clearChat,
    endSession,
    sendFeedback,
    needsAuth,
    authLoading,
    error,
  }
}
