'use client'

import { useState, useCallback, useRef } from 'react';
import { Message, ChatState, TaskEvent } from '@/types/chat';
import { detectTool } from '@/lib/toolDetection';
import { streamFromMastra } from '@/lib/chatClient';
import { devMode } from '@/config/features';
import { useUpgradeModal } from '@/components/common/upgrade-modal';

export function useChat() {
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

  const { openModal } = useUpgradeModal();
  const streamingCancelRef = useRef<(() => void) | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string>('dev-user-1'); // TODO: replace with real identity later

  const generateId = (): string => Math.random().toString(36).substr(2, 9);

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
    try {
      await streamFromMastra({
        messages: apiMessages,
        sessionId,
        userId: userIdRef.current,
        profile,
        signal: controller.signal,
        apiPath: devMode ? '/api/chat/dev' : '/api/chat',
        onTask: (evt) => {
          upsertTaskForMessage(assistantId, evt)
        },
        onChunk: (chunk, done) => {
          accumulated += chunk;
          updateMessage(assistantId, { content: accumulated, streaming: !done });
          if (done) {
            setState((prev: any) => ({ ...prev, isStreaming: false, currentStreamingId: undefined }));
            streamingCancelRef.current = null;
            // Persist assistant message (fire-and-forget)
            persistMessage(sessionId, 'assistant', accumulated).catch(() => {});
          }
        },
        onError: (error) => {
          if (error.message === 'Rate limit reached') {
            openModal(
              'Daily Limit Reached',
              'You have reached your daily message limit. Please upgrade to a paid plan for unlimited messages.'
            );
            // Remove the empty assistant message placeholder
            setState((prev: any) => ({
              ...prev,
              messages: prev.messages.filter((m: Message) => m.id !== assistantId),
              isStreaming: false,
              currentStreamingId: undefined,
            }));
          } else {
            // Handle other stream errors
            updateMessage(assistantId, { content: `Error: ${error.message}`, streaming: false });
          }
          streamingCancelRef.current = null;
        }
      });
    } catch (e) {
      // Mark stream ended and show basic error if needed
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

  return {
    messages: (state as any).messages,
    isStreaming: (state as any).isStreaming,
    currentStreamingId: (state as any).currentStreamingId,
    hasActiveSession: (state as any).hasActiveSession as boolean,
    tasksByMessage: (state as any).tasksByMessage as Record<string, TaskEvent[]>,
    sendMessage,
    clearChat,
    endSession,
    rerunTool,
  };
}
