'use client'

import { useState, useCallback, useRef } from 'react';
import { Message, ChatState } from '@/types/chat';
import { detectTool } from '@/lib/toolDetection';
import { streamFromMastra } from '@/lib/chatClient';

export function useChat() {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isStreaming: false,
    currentStreamingId: undefined
  });

  const streamingCancelRef = useRef<(() => void) | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string>('dev-user-1'); // TODO: replace with real identity later

  const generateId = (): string => Math.random().toString(36).substr(2, 9);

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(msg => (msg.id === id ? { ...msg, ...updates } : msg)),
    }));
  }, []);

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
    if (!content.trim() || state.isStreaming) return;

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

    setState(prev => ({ ...prev, messages: [...prev.messages, userMessage] }));

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
      tool: tool || undefined,
      streaming: true,
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, assistantMessage],
      isStreaming: true,
      currentStreamingId: assistantId,
    }));

    // Ensure session and persist the user message (fire-and-forget)
    const sessionId = await ensureSession();
    persistMessage(sessionId, 'user', userMessage.content).catch(() => {});

    // Prepare AbortController for stream cancellation
    const controller = new AbortController();
    streamingCancelRef.current = () => controller.abort();

    // Build plain messages array for the API
    const apiMessages = [...state.messages, userMessage].map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content }));

    let accumulated = '';
    try {
      await streamFromMastra({
        messages: apiMessages,
        sessionId,
        userId: userIdRef.current,
        signal: controller.signal,
        onChunk: (chunk, done) => {
          accumulated += chunk;
          updateMessage(assistantId, { content: accumulated, streaming: !done });
          if (done) {
            setState(prev => ({ ...prev, isStreaming: false, currentStreamingId: undefined }));
            streamingCancelRef.current = null;
            // Persist assistant message (fire-and-forget)
            persistMessage(sessionId, 'assistant', accumulated).catch(() => {});
          }
        },
      });
    } catch (e) {
      // Mark stream ended and show basic error if needed
      setState(prev => ({ ...prev, isStreaming: false, currentStreamingId: undefined }));
      streamingCancelRef.current = null;
      if (accumulated.length === 0) {
        updateMessage(assistantId, { content: 'Sorry, something went wrong while streaming the response.', streaming: false });
      }
    }
  }, [ensureSession, persistMessage, state.isStreaming, state.messages, updateMessage]);

  const clearChat = useCallback(() => {
    if (streamingCancelRef.current) {
      streamingCancelRef.current();
    }
    setState({ messages: [], isStreaming: false, currentStreamingId: undefined });
    // Intentionally do not reset sessionIdRef here to satisfy: no resume within same page; new session will be created on first send after reload
  }, []);

  const rerunTool = useCallback((messageId: string) => {
    const message = state.messages.find(m => m.id === messageId);
    if (!message || !message.tool) return;
    const idx = state.messages.findIndex(m => m.id === messageId);
    const userMessage = idx > 0 ? state.messages[idx - 1] : null;
    if (userMessage && userMessage.role === 'user') {
      sendMessage(userMessage.content);
    }
  }, [state.messages, sendMessage]);

  return {
    messages: state.messages,
    isStreaming: state.isStreaming,
    currentStreamingId: state.currentStreamingId,
    sendMessage,
    clearChat,
    rerunTool,
  };
}
