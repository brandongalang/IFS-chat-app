'use client'

import { useState, useCallback, useRef, useEffect } from 'react';
import { useUser } from '@/context/UserContext'
import { useSearchParams } from 'next/navigation'
import { Message, ChatState, TaskEvent } from '@/types/chat';
import { getPartById } from '@/lib/data/parts-lite'
import { streamFromMastra } from '@/lib/chatClient';
import { useToast } from './use-toast';

export function useChat() {
  const searchParams = useSearchParams()
  const { profile } = useUser()
  const needsAuth = !profile
  const [state, setState] = useState<ChatState>({
    messages: [],
    isStreaming: false,
    currentStreamingId: undefined,
    // augmenting state shape locally; downstream components only read fields we return
    // hasActiveSession is maintained for UI checks like confirming before exiting chat
    hasActiveSession: false,
    tasksByMessage: {} as Record<string, TaskEvent[]>,
  });

  const streamingCancelRef = useRef<(() => void) | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const DEV_FALLBACK = process.env.NEXT_PUBLIC_DEV_USER_ID ?? 'dev-user-1';
  const userIdRef = useRef<string>(DEV_FALLBACK);

  const generateId = (): string => Math.random().toString(36).substr(2, 9);

  useEffect(() => {
    if (profile?.id) {
      userIdRef.current = profile.id;
    } else if (process.env.NODE_ENV !== 'development') {
      userIdRef.current = '';
    }
  }, [profile]);

  useEffect(() => {
    const partId = searchParams.get('partId')
    if (partId && state.messages.length === 0) {
      // This is a new chat session focused on a specific part.
      // Let's create a custom initial message.
      const fetchPartAndStart = async () => {
        try {
          const part = await getPartById({ partId })
          if (part) {
            const partName = part.name
            const initialMessage: Message = {
              id: generateId(),
              role: 'assistant',
              content: `Let's talk about your "${partName}" part. What's on your mind regarding it?`,
              timestamp: Date.now(),
              persona: 'claude',
              streaming: false,
              tasks: [],
            }
            setState((prev: ChatState) => ({ ...prev, messages: [initialMessage] }))
          }
        } catch {
          // ignore errors fetching part
        }
      }
      fetchPartAndStart()
    }
  }, [searchParams])

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setState((prev: ChatState) => ({
      ...prev,
      messages: prev.messages.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg)),
    }));
  }, []);

  const upsertTaskForMessage = useCallback((messageId: string, evt: TaskEvent) => {
    setState((prev: ChatState) => {
      const existing: Record<string, TaskEvent[]> = prev.tasksByMessage ?? {}
      const currentList = existing[messageId] || []
      const idx = currentList.findIndex((t) => t.id === evt.id)
      const nextList = idx >= 0
        ? currentList.map((t) => (t.id === evt.id ? { ...t, ...evt } : t))
        : [...currentList, evt]
      return {
        ...prev,
        tasksByMessage: { ...existing, [messageId]: nextList },
        messages: (prev.messages || []).map((m) => m.id === messageId ? { ...m, tasks: nextList } : m),
      }
    })
  }, [])

  const { toast } = useToast();

  const ensureSession = useCallback(async (): Promise<string> => {
    if (needsAuth) throw new Error('Authentication required')
    if (sessionIdRef.current) return sessionIdRef.current;
    try {
      const res = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userIdRef.current }),
      });
      if (!res.ok) throw new Error('Failed to start session');
      const data = await res.json();
      sessionIdRef.current = data.sessionId;
      setState((prev: ChatState) => ({ ...prev, hasActiveSession: true }));
      return data.sessionId;
    } catch (error: any) {
      console.error('Error starting session:', error);
      toast({ title: 'Session failed', description: error.message, variant: 'destructive' });
      throw error;
    }
  }, [toast, needsAuth]);

  const persistMessage = useCallback(async (sessionId: string, role: 'user' | 'assistant', content: string) => {
    if (needsAuth) return
    try {
      const res = await fetch('/api/session/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, role, content }),
      });
      if (!res.ok) throw new Error('Failed to persist message');
    } catch (error: any) {
      console.error('Error persisting message:', error);
      toast({ title: 'Persist failed', description: error.message, variant: 'destructive' });
      throw error;
    }
  }, [toast, needsAuth]);

  // Add a non-streaming assistant message (optionally persisted)
  const addAssistantMessage = useCallback(async (content: string, opts?: { persist?: boolean; id?: string; persona?: 'claude' | 'default' }) => {
    if (needsAuth) return
    const id = (opts && opts.id) || generateId()
    const msg: Message = {
      id,
      role: 'assistant',
      content,
      timestamp: Date.now(),
      persona: opts?.persona || 'claude',
      streaming: false,
      tasks: [],
    }
    setState((prev: ChatState) => ({ ...prev, messages: [...prev.messages, msg] }))
    if (opts?.persist) {
      try {
        const sessionId = await ensureSession()
        await persistMessage(sessionId, 'assistant', content)
      } catch {}
    }
  }, [ensureSession, persistMessage, needsAuth])

  const sendMessage = useCallback(async (content: string) => {
    if (needsAuth || !content.trim() || state.isStreaming) return;

    // Cancel any ongoing streaming
    if (streamingCancelRef.current) {
      streamingCancelRef.current();
    }

    // Add user message locally
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };

    setState((prev: ChatState) => ({ ...prev, messages: [...prev.messages, userMessage] }));

    // Create streaming assistant placeholder
    const assistantId = generateId();
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      persona: 'claude',
      // tool UI deprecated in favor of Task UI
      streaming: true,
      tasks: [],
    };

    setState((prev: ChatState) => ({
      ...prev,
      messages: [...prev.messages, assistantMessage],
      isStreaming: true,
      currentStreamingId: assistantId,
      tasksByMessage: { ...(prev.tasksByMessage ?? {}), [assistantId]: [] },
    }));

    // Ensure session and persist the user message (fire-and-forget)
    const sessionId = await ensureSession();
    persistMessage(sessionId, 'user', userMessage.content).catch(() => {});

    // Prepare AbortController for stream cancellation
    const controller = new AbortController();
    streamingCancelRef.current = () => controller.abort();

    // Build plain messages array for the API
    const apiMessages = [...state.messages, userMessage].map((m) => ({ role: m.role, content: m.content }));

    let accumulated = '';
    let buffer = '';
    let flushInterval: any = null
    let finalizeTimer: any = null

    const finalize = () => {
      updateMessage(assistantId, { content: accumulated, streaming: false })
      setState((prev: ChatState) => ({ ...prev, isStreaming: false, currentStreamingId: undefined }));
      streamingCancelRef.current = null;
    }

    const scheduleFinalizeCheck = () => {
      if (finalizeTimer) return
      finalizeTimer = setInterval(() => {
        if (!flushInterval && buffer.length === 0) {
          clearInterval(finalizeTimer)
          finalizeTimer = null
          finalize()
        }
      }, 60)
    }

    // Read CSS variables for streaming cadence
    const stepMs = typeof window !== 'undefined' ? (Number(getComputedStyle(document.documentElement).getPropertyValue('--eth-stream-tick').trim()) || 150) : 150
    const stepChars = typeof window !== 'undefined' ? (Number(getComputedStyle(document.documentElement).getPropertyValue('--eth-stream-chars').trim()) || 8) : 8
    const startFlusher = () => {
      if (flushInterval) return
      flushInterval = setInterval(() => {
        if (buffer.length > 0) {
          const take = Math.min(stepChars, buffer.length)
          const part = buffer.slice(0, take)
          buffer = buffer.slice(take)
          accumulated += part
          updateMessage(assistantId, { content: accumulated, streaming: true })
        } else {
          // no buffer left; flusher can stop
          clearInterval(flushInterval)
          flushInterval = null
          // If a done signal was received earlier, ensure finalization proceeds
          scheduleFinalizeCheck()
        }
      }, stepMs)
    }
    const stopFlusher = () => {
      if (flushInterval) {
        clearInterval(flushInterval)
        flushInterval = null
      }
    }

    try {
      // Always use main agent for ethereal chat (not the dev stream)
      const chosenApiPath = '/api/chat'
      let doneReceived = false

      await streamFromMastra({
        messages: apiMessages,
        sessionId,
        userId: userIdRef.current,
        profile: profile ?? { name: '', bio: '' },
        signal: controller.signal,
        apiPath: chosenApiPath,
        onTask: (evt) => {
          upsertTaskForMessage(assistantId, evt)
        },
        onChunk: (chunk, done) => {
          // accumulate; flusher reveals a few characters per tick for ethereal smoothness
          if (chunk) buffer += chunk
          startFlusher()
          if (done) {
            doneReceived = true
            // Begin polling for flusher completion; finalize when buffer empties
            scheduleFinalizeCheck()
            // Also persist once finalized; we hook into finalize() by adding a microtask here
            queueMicrotask(() => {
              const tryPersist = () => {
                if (!flushInterval && buffer.length === 0) {
                  persistMessage(sessionId, 'assistant', accumulated).catch(() => {})
                } else {
                  // retry shortly until finalize completes
                  setTimeout(tryPersist, 120)
                }
              }
              tryPersist()
            })
          }
        },
      });
    } catch (error: any) {
      // Mark stream ended and show basic error if needed
      stopFlusher()
      setState((prev: ChatState) => ({ ...prev, isStreaming: false, currentStreamingId: undefined }));
      streamingCancelRef.current = null;
      if (accumulated.length === 0) {
        updateMessage(assistantId, { content: 'Sorry, something went wrong while streaming the response.', streaming: false });
      }
      console.error('Stream failed:', error);
      toast({ title: 'Stream failed', description: (error as Error)?.message ?? 'Unknown error', variant: 'destructive' });
    }
  }, [ensureSession, persistMessage, state.isStreaming, state.messages, updateMessage, toast, needsAuth]);

  const clearChat = useCallback(() => {
    if (streamingCancelRef.current) {
      streamingCancelRef.current();
    }
    setState((prev: ChatState) => ({ ...prev, messages: [], isStreaming: false, currentStreamingId: undefined }));
    // Intentionally do not reset sessionIdRef here to satisfy: no resume within same page; new session will be created on first send after reload
  }, []);

  const endSession = useCallback(async () => {
    if (needsAuth) return
    const id = sessionIdRef.current
    if (!id) {
      // Nothing to end
      setState((prev: ChatState) => ({ ...prev, hasActiveSession: false, messages: [], isStreaming: false, currentStreamingId: undefined }))
      return
    }
    try {
      await fetch('/api/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id }),
      })
    } catch {
      // ignore
    } finally {
      sessionIdRef.current = null
      setState((prev: ChatState) => ({ ...prev, hasActiveSession: false, messages: [], isStreaming: false, currentStreamingId: undefined }))
    }
  }, [needsAuth])

  const sendFeedback = useCallback(async (
    messageId: string,
    rating: 'thumb_up' | 'thumb_down',
    explanation?: string
  ) => {
    if (needsAuth) return
    const sessionId = sessionIdRef.current;
    if (!sessionId) {
      toast({
        title: 'Error',
        description: 'No active session to submit feedback for.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          messageId,
          rating,
          explanation,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      toast({
        title: 'Feedback submitted',
        description: 'Thank you for your feedback!',
      });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: 'Error',
        description: 'Could not submit feedback. Please try again later.',
        variant: 'destructive',
      });
    }
  }, [toast, needsAuth]);

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
  };
}
