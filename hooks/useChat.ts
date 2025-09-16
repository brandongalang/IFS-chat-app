'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { getPartById } from '@/lib/data/parts-lite'
import { streamFromMastra } from '@/lib/chatClient'
import type { Message, TaskEvent, TaskEventUpdate } from '@/types/chat'
import { useChatState } from './useChatState'
import { useChatSession } from './useChatSession'
import { useToast } from './use-toast'
import { useStreamBuffer } from './useStreamBuffer'
import { useUser } from '@/context/UserContext'

export function useChat() {
  const searchParams = useSearchParams()
  const { profile } = useUser()
  const needsAuth = !profile

  const { state, addMessage, updateMessage, mergeState, setTasks, reset } = useChatState()
  const { ensureSession: ensureSessionRaw, persistMessage: persistMessageRaw, endSession: endSessionRaw, getSessionId } =
    useChatSession()
  const { toast } = useToast()
  const createStreamBuffer = useStreamBuffer()

  const streamingCancelRef = useRef<(() => void) | null>(null)
  const generateId = (): string => Math.random().toString(36).slice(2)

  useEffect(() => {
    const partId = searchParams.get('partId')
    if (!partId || state.messages.length > 0) return

    const fetchPartAndStart = async () => {
      try {
        const part = await getPartById({ partId })
        if (part) {
          const partName = part.name ?? 'part'
          const initialMessage: Message = {
            id: generateId(),
            role: 'assistant',
            content: `Let's talk about your "${partName}" part. What's on your mind regarding it?`,
            timestamp: Date.now(),
            persona: 'claude',
            streaming: false,
            tasks: [],
          }
          mergeState({ messages: [initialMessage] })
        }
      } catch {
        // ignore fetch errors; chat can still start without the tailored prompt
      }
    }

    void fetchPartAndStart()
  }, [searchParams, state.messages.length, mergeState])

  const upsertTaskForMessage = useCallback(
    (messageId: string, evt: TaskEventUpdate) => {
      const existing = state.tasksByMessage ?? {}
      const currentList = existing[messageId] ?? []
      const idx = currentList.findIndex((task) => task.id === evt.id)

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

      const nextList =
        idx >= 0
          ? currentList.map((task, taskIndex) => (taskIndex === idx ? mergeTask(task, evt) : task))
          : [...currentList, mergeTask(undefined, evt)]

      setTasks(messageId, nextList)
    },
    [setTasks, state.tasksByMessage],
  )

  const ensureSession = useCallback(async (): Promise<string> => {
    if (needsAuth) {
      const error = new Error('Authentication required')
      toast({ title: 'Session failed', description: error.message, variant: 'destructive' })
      throw error
    }

    try {
      const sessionId = await ensureSessionRaw()
      mergeState({ hasActiveSession: true })
      return sessionId
    } catch (error: unknown) {
      console.error('Error starting session:', error)
      toast({
        title: 'Session failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
      throw error
    }
  }, [ensureSessionRaw, mergeState, needsAuth, toast])

  const persistMessage = useCallback(
    async (sessionId: string, role: 'user' | 'assistant', content: string) => {
      if (needsAuth) return
      try {
        await persistMessageRaw(sessionId, role, content)
      } catch (error: unknown) {
        console.error('Error persisting message:', error)
        toast({
          title: 'Persist failed',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        })
        throw error
      }
    },
    [needsAuth, persistMessageRaw, toast],
  )

  const addAssistantMessage = useCallback(
    async (content: string, opts?: { persist?: boolean; id?: string; persona?: 'claude' | 'default' }) => {
      if (needsAuth) return
      const id = opts?.id ?? generateId()
      const message: Message = {
        id,
        role: 'assistant',
        content,
        timestamp: Date.now(),
        persona: opts?.persona ?? 'claude',
        streaming: false,
        tasks: [],
      }

      addMessage(message)

      if (opts?.persist) {
        try {
          const sessionId = await ensureSession()
          await persistMessage(sessionId, 'assistant', content)
        } catch {
          // persistence failures already surfaced via toast; keep chat available
        }
      }
    },
    [addMessage, ensureSession, needsAuth, persistMessage],
  )

  const sendMessage = useCallback(
    async (content: string) => {
      if (needsAuth || !content.trim() || state.isStreaming) return

      if (streamingCancelRef.current) {
        streamingCancelRef.current()
      }

      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content: content.trim(),
        timestamp: Date.now(),
      }

      addMessage(userMessage)

      const assistantId = generateId()
      const assistantMessage: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        persona: 'claude',
        streaming: true,
        tasks: [],
      }

      addMessage(assistantMessage)
      mergeState({
        isStreaming: true,
        currentStreamingId: assistantId,
        tasksByMessage: { ...(state.tasksByMessage ?? {}), [assistantId]: [] },
      })

      const sessionId = await ensureSession()
      persistMessage(sessionId, 'user', userMessage.content).catch(() => {})

      const controller = new AbortController()
      streamingCancelRef.current = () => controller.abort()

      const apiMessages = [...state.messages, userMessage].map((message) => ({ role: message.role, content: message.content }))

      const streamBuffer = createStreamBuffer({
        onUpdate: (messageContent, streaming) => {
          updateMessage(assistantId, { content: messageContent, streaming })
        },
      })

      let shouldPersistAssistant = false
      let streamError: unknown = null

      try {
        await streamFromMastra({
          messages: apiMessages,
          sessionId,
          profile: profile ?? { name: '', bio: '' },
          signal: controller.signal,
          apiPath: '/api/chat',
          onTask: (evt) => upsertTaskForMessage(assistantId, evt),
          onChunk: (chunk, done) => {
            if (chunk) {
              streamBuffer.appendTokens(chunk)
            }
            if (done) {
              shouldPersistAssistant = true
            }
          },
        })
      } catch (error: unknown) {
        streamError = error
      }

      const finalContent = await streamBuffer.finalize()

      mergeState({ isStreaming: false, currentStreamingId: undefined })
      streamingCancelRef.current = null

      if (streamError) {
        if (finalContent.length === 0) {
          updateMessage(assistantId, {
            content: 'Sorry, something went wrong while streaming the response.',
            streaming: false,
          })
        }
        console.error('Stream failed:', streamError)
        toast({
          title: 'Stream failed',
          description: streamError instanceof Error ? streamError.message : 'Unknown error',
          variant: 'destructive',
        })
        return
      }

      if (shouldPersistAssistant) {
        persistMessage(sessionId, 'assistant', finalContent).catch(() => {})
      }
    },
    [
      addMessage,
      createStreamBuffer,
      ensureSession,
      mergeState,
      needsAuth,
      persistMessage,
      profile,
      state.isStreaming,
      state.messages,
      state.tasksByMessage,
      toast,
      updateMessage,
      upsertTaskForMessage,
    ],
  )

  const clearChat = useCallback(() => {
    if (streamingCancelRef.current) {
      streamingCancelRef.current()
    }
    reset()
  }, [reset])

  const endSession = useCallback(async () => {
    if (needsAuth) {
      reset()
      return
    }

    await endSessionRaw().catch(() => {})
    reset()
  }, [endSessionRaw, needsAuth, reset])

  const sendFeedback = useCallback(
    async (messageId: string, rating: 'thumb_up' | 'thumb_down', explanation?: string) => {
      if (needsAuth) return
      const sessionId = getSessionId()
      if (!sessionId) {
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
          body: JSON.stringify({ sessionId, messageId, rating, explanation }),
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
    [getSessionId, needsAuth, toast],
  )

  return {
    messages: state.messages,
    isStreaming: state.isStreaming,
    currentStreamingId: state.currentStreamingId,
    hasActiveSession: state.hasActiveSession ?? false,
    tasksByMessage: state.tasksByMessage ?? {},
    sendMessage,
    addAssistantMessage,
    clearChat,
    endSession,
    sendFeedback,
    needsAuth,
  }
}
