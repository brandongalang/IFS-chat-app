'use client'

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation'
import { Message, ChatState, TaskEvent } from '@/types/chat';
import { getPartById } from '@/mastra/tools/part-tools'
import { detectTool } from '@/lib/toolDetection';
import { streamFromMastra } from '@/lib/chatClient';
import { devMode } from '@/config/features';
import { useToast } from './use-toast';

export function useChat() {
  const searchParams = useSearchParams()
  const [state, setState] = useState<ChatState>({
    messages: [],
    isStreaming: false,
    currentStreamingId: undefined,
    // augmenting state shape locally; downstream components only read fields we return
    // hasActiveSession is maintained for UI checks like confirming before exiting chat
    hasActiveSession: false,
    tasksByMessage: {},
  } as any);

  // #region Proposing Next Steps for Full Integration
  // In a real app, this profile data would not be managed by local state here.
  // Instead, it would be provided by a global UserContext or a similar state management solution (like Zustand or Redux).
  // This would ensure that the profile data is consistent across the application (e.g., in the chat and on the profile page).
  //
  // Example with a context:
  //
  // import { useUser } from '@/context/UserContext'
  // const { profile } = useUser()
  //
  // The UserContext would be responsible for fetching and storing the user's profile data from Supabase.
  // #endregion

  // In a real app, this would come from a user context or store
  const [profile, setProfile] = useState({
    name: 'Alex',
    bio: 'Exploring the inner world, one part at a time.',
  });

  const streamingCancelRef = useRef<(() => void) | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string>('dev-user-1'); // TODO: replace with real identity later

  const generateId = (): string => Math.random().toString(36).substr(2, 9);

  useEffect(() => {
    const partId = searchParams.get('partId')
    if (partId && (state as any).messages.length === 0) {
      // This is a new chat session focused on a specific part.
      // Let's create a custom initial message.
      const fetchPartAndStart = async () => {
        const result = await getPartById({ partId })
        if (result.success && result.data) {
          const partName = result.data.name
          const initialMessage: Message = {
            id: generateId(),
            role: 'assistant',
            content: `Let's talk about your "${partName}" part. What's on your mind regarding it?`,
            timestamp: Date.now(),
            persona: 'claude',
            streaming: false,
            tasks: [],
          }
          setState((prev: any) => ({ ...prev, messages: [initialMessage] }))
        }
      }
      fetchPartAndStart()
    }
  }, [searchParams])

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setState((prev: any) => ({
      ...prev,
      messages: prev.messages.map((msg: Message) => (msg.id === id ? { ...msg, ...updates } : msg)),
    }));
  }, []);

  const upsertTaskForMessage = useCallback((messageId: string, evt: TaskEvent) => {
    setState((prev: any) => {
      const existing: Record<string, TaskEvent[]> = prev.tasksByMessage || {}
      const currentList = existing[messageId] || []
      const idx = currentList.findIndex((t) => t.id === evt.id)
      const nextList = idx >= 0
        ? currentList.map((t) => (t.id === evt.id ? { ...t, ...evt } : t))
        : [...currentList, evt]
      return {
        ...prev,
        tasksByMessage: { ...existing, [messageId]: nextList },
        messages: (prev.messages || []).map((m: any) => m.id === messageId ? { ...m, tasks: nextList } : m),
      }
    })
  }, [])

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionIdRef.current) return sessionIdRef.current;
    const res = await fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userIdRef.current }),
    });
    if (!res.ok) throw new Error('Failed to start session');
    const data = await res.json();
    sessionIdRef.current = data.sessionId;
    setState((prev: any) => ({ ...prev, hasActiveSession: true }));
    return data.sessionId;
  }, []);

  const persistMessage = useCallback(async (sessionId: string, role: 'user' | 'assistant', content: string) => {
    try {
      await fetch('/api/session/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, role, content }),
      });
    } catch {
      // non-blocking
    }
  }, []);

  // Add a non-streaming assistant message (optionally persisted)
  const addAssistantMessage = useCallback(async (content: string, opts?: { persist?: boolean; id?: string; persona?: 'claude' | 'default' }) => {
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
    setState((prev: any) => ({ ...prev, messages: [...prev.messages, msg] }))
    if (opts?.persist) {
      try {
        const sessionId = await ensureSession()
        await persistMessage(sessionId, 'assistant', content)
      } catch {}
    }
  }, [ensureSession, persistMessage])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || (state as any).isStreaming) return;

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

    setState((prev: any) => ({ ...prev, messages: [...prev.messages, userMessage] }));

    // Detect tool to show in UI (still purely client-side for now)
    const tool = detectTool(content);

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

    setState((prev: any) => ({
      ...prev,
      messages: [...prev.messages, assistantMessage],
      isStreaming: true,
      currentStreamingId: assistantId,
      tasksByMessage: { ...(prev as any).tasksByMessage, [assistantId]: [] },
    }));

    // Ensure session and persist the user message (fire-and-forget)
    const sessionId = await ensureSession();
    persistMessage(sessionId, 'user', userMessage.content).catch(() => {});

    // Prepare AbortController for stream cancellation
    const controller = new AbortController();
    streamingCancelRef.current = () => controller.abort();

    // Build plain messages array for the API
    const apiMessages = [...(state as any).messages, userMessage].map((m: any) => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content }));

    let accumulated = '';
    let buffer = '';
    let flushInterval: any = null
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
          // no buffer left; flusher can stop; finalization handled by onChunk(done)
          clearInterval(flushInterval)
          flushInterval = null
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
        profile,
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
            // finalize happens in the flusher once buffer empties
            const finishIfReady = () => {
              if (!flushInterval && (buffer.length === 0)) {
                updateMessage(assistantId, { content: accumulated, streaming: false })
                setState((prev: any) => ({ ...prev, isStreaming: false, currentStreamingId: undefined }));
                streamingCancelRef.current = null;
                persistMessage(sessionId, 'assistant', accumulated).catch(() => {});
              }
            }
            // small timeout to allow last tick to run
            setTimeout(finishIfReady, 80)
          }
        },
      });
    } catch (e) {
      // Mark stream ended and show basic error if needed
      stopFlusher()
      setState((prev: any) => ({ ...prev, isStreaming: false, currentStreamingId: undefined }));
      streamingCancelRef.current = null;
      if (accumulated.length === 0) {
        updateMessage(assistantId, { content: 'Sorry, something went wrong while streaming the response.', streaming: false });
      }
    }
  }, [ensureSession, persistMessage, (state as any).isStreaming, (state as any).messages, updateMessage]);

  const clearChat = useCallback(() => {
    if (streamingCancelRef.current) {
      streamingCancelRef.current();
    }
    setState((prev: any) => ({ ...prev, messages: [], isStreaming: false, currentStreamingId: undefined }));
    // Intentionally do not reset sessionIdRef here to satisfy: no resume within same page; new session will be created on first send after reload
  }, []);

  const endSession = useCallback(async () => {
    const id = sessionIdRef.current
    if (!id) {
      // Nothing to end
      setState((prev: any) => ({ ...prev, hasActiveSession: false, messages: [], isStreaming: false, currentStreamingId: undefined }))
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
      setState((prev: any) => ({ ...prev, hasActiveSession: false, messages: [], isStreaming: false, currentStreamingId: undefined }))
    }
  }, [])

  const rerunTool = useCallback((messageId: string) => {
    const message = (state as any).messages.find((m: any) => m.id === messageId);
    if (!message || !message.tool) return;
    const idx = (state as any).messages.findIndex((m: any) => m.id === messageId);
    const userMessage = idx > 0 ? (state as any).messages[idx - 1] : null;
    if (userMessage && userMessage.role === 'user') {
      sendMessage(userMessage.content);
    }
  }, [(state as any).messages, sendMessage]);

  const { toast } = useToast();

  const sendFeedback = useCallback(async (
    messageId: string,
    rating: 'thumb_up' | 'thumb_down',
    explanation?: string
  ) => {
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
  }, [toast]);

  return {
    messages: (state as any).messages,
    isStreaming: (state as any).isStreaming,
    currentStreamingId: (state as any).currentStreamingId,
    hasActiveSession: (state as any).hasActiveSession as boolean,
    tasksByMessage: (state as any).tasksByMessage as Record<string, TaskEvent[]>,
    sendMessage,
    addAssistantMessage,
    clearChat,
    endSession,
    rerunTool,
    sendFeedback,
  };
}
