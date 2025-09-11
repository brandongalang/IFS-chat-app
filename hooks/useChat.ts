'use client'

import { useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation'
import { Message, TaskEvent } from '@/types/chat';
import { getPartById } from '@/lib/data/parts-lite'
import { detectTool } from '@/lib/toolDetection';
import { streamFromMastra } from '@/lib/chatClient';
import { devMode } from '@/config/features';
import { useToast } from './use-toast';
import { useChatState } from './useChatState';
import { useChatSession } from './useChatSession';
import { useUser } from '@/context/UserContext';

export function useChat() {
  const searchParams = useSearchParams();
  const { state, addMessage, updateMessage, mergeState, setTasks, reset } = useChatState();
  const { ensureSession, persistMessage, endSession: endSessionRequest, getSessionId } = useChatSession();
  const { id: userId, profile } = useUser();

  const streamingCancelRef = useRef<(() => void) | null>(null);

  const generateId = (): string => Math.random().toString(36).substr(2, 9);

  useEffect(() => {
    const partId = searchParams.get('partId');
    if (partId && state.messages.length === 0) {
      const fetchPartAndStart = async () => {
        const result = await getPartById({ partId });
        if (result.success && result.data) {
          const partName = result.data.name;
          const initialMessage: Message = {
            id: generateId(),
            role: 'assistant',
            content: `Let's talk about your "${partName}" part. What's on your mind regarding it?`,
            timestamp: Date.now(),
            persona: 'claude',
            streaming: false,
            tasks: [],
          };
          mergeState({ messages: [initialMessage] });
        }
      };
      fetchPartAndStart();
    }
  }, [searchParams, state.messages, mergeState]);

  const upsertTaskForMessage = useCallback(
    (messageId: string, evt: TaskEvent) => {
      const existing = state.tasksByMessage?.[messageId] || [];
      const idx = existing.findIndex((t) => t.id === evt.id);
      const nextList =
        idx >= 0 ? existing.map((t) => (t.id === evt.id ? { ...t, ...evt } : t)) : [...existing, evt];
      setTasks(messageId, nextList);
    },
    [setTasks, state.tasksByMessage]
  );

  // Add a non-streaming assistant message (optionally persisted)
  const addAssistantMessage = useCallback(
    async (content: string, opts?: { persist?: boolean; id?: string; persona?: 'claude' | 'default' }) => {
      const id = (opts && opts.id) || generateId();
      const msg: Message = {
        id,
        role: 'assistant',
        content,
        timestamp: Date.now(),
        persona: opts?.persona || 'claude',
        streaming: false,
        tasks: [],
      };
      addMessage(msg);
      if (opts?.persist) {
        try {
          const sessionId = await ensureSession();
          mergeState({ hasActiveSession: true });
          await persistMessage(sessionId, 'assistant', content);
        } catch {}
      }
    },
    [addMessage, ensureSession, persistMessage, mergeState]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || state.isStreaming) return;

      if (streamingCancelRef.current) {
        streamingCancelRef.current();
      }

      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content: content.trim(),
        timestamp: Date.now(),
      };

      addMessage(userMessage);

      const _tool = detectTool(content);

      const assistantId = generateId();
      const assistantMessage: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        persona: 'claude',
        streaming: true,
        tasks: [],
      };

      addMessage(assistantMessage);
      mergeState({
        isStreaming: true,
        currentStreamingId: assistantId,
        tasksByMessage: { ...(state.tasksByMessage ?? {}), [assistantId]: [] },
      });

      const sessionId = await ensureSession();
      mergeState({ hasActiveSession: true });
      persistMessage(sessionId, 'user', userMessage.content).catch(() => {});

      const controller = new AbortController();
      streamingCancelRef.current = () => controller.abort();

      const apiMessages = [...state.messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let accumulated = '';
      let buffer = '';
      let flushInterval: any = null;
      let finalizeTimer: any = null;

      const finalize = () => {
        updateMessage(assistantId, { content: accumulated, streaming: false });
        mergeState({ isStreaming: false, currentStreamingId: undefined });
        streamingCancelRef.current = null;
      };

      const scheduleFinalizeCheck = () => {
        if (finalizeTimer) return;
        finalizeTimer = setInterval(() => {
          if (!flushInterval && buffer.length === 0) {
            clearInterval(finalizeTimer);
            finalizeTimer = null;
            finalize();
          }
        }, 60);
      };

      const stepMs =
        typeof window !== 'undefined'
          ? Number(getComputedStyle(document.documentElement).getPropertyValue('--eth-stream-tick').trim()) || 150
          : 150;
      const stepChars =
        typeof window !== 'undefined'
          ? Number(getComputedStyle(document.documentElement).getPropertyValue('--eth-stream-chars').trim()) || 8
          : 8;

      const startFlusher = () => {
        if (flushInterval) return;
        flushInterval = setInterval(() => {
          if (buffer.length > 0) {
            const take = Math.min(stepChars, buffer.length);
            const part = buffer.slice(0, take);
            buffer = buffer.slice(take);
            accumulated += part;
            updateMessage(assistantId, { content: accumulated, streaming: true });
          } else {
            clearInterval(flushInterval);
            flushInterval = null;
            scheduleFinalizeCheck();
          }
        }, stepMs);
      };
      const stopFlusher = () => {
        if (flushInterval) {
          clearInterval(flushInterval);
          flushInterval = null;
        }
      };

      try {
        const chosenApiPath = '/api/chat';
        let doneReceived = false;

        await streamFromMastra({
          messages: apiMessages,
          sessionId,
          userId,
          profile,
          signal: controller.signal,
          apiPath: chosenApiPath,
          onTask: (evt) => {
            upsertTaskForMessage(assistantId, evt);
          },
          onChunk: (chunk, done) => {
            if (chunk) buffer += chunk;
            startFlusher();
            if (done) {
              doneReceived = true;
              scheduleFinalizeCheck();
              queueMicrotask(() => {
                const tryPersist = () => {
                  if (!flushInterval && buffer.length === 0) {
                    persistMessage(sessionId, 'assistant', accumulated).catch(() => {});
                  } else {
                    setTimeout(tryPersist, 120);
                  }
                };
                tryPersist();
              });
            }
          },
        });
      } catch (e) {
        stopFlusher();
        mergeState({ isStreaming: false, currentStreamingId: undefined });
        streamingCancelRef.current = null;
        if (accumulated.length === 0) {
          updateMessage(assistantId, {
            content: 'Sorry, something went wrong while streaming the response.',
            streaming: false,
          });
        }
      }
    },
    [
      ensureSession,
      persistMessage,
      state.isStreaming,
      state.messages,
      state.tasksByMessage,
      updateMessage,
      mergeState,
      addMessage,
      userId,
      profile,
      upsertTaskForMessage,
    ]
  );

  const clearChat = useCallback(() => {
    if (streamingCancelRef.current) {
      streamingCancelRef.current();
    }
    mergeState({ messages: [], isStreaming: false, currentStreamingId: undefined });
  }, [mergeState]);

  const endSession = useCallback(async () => {
    await endSessionRequest();
    reset();
  }, [endSessionRequest, reset]);

  const rerunTool = useCallback(
    (messageId: string) => {
      const message = state.messages.find((m) => m.id === messageId);
      if (!message || !message.tool) return;
      const idx = state.messages.findIndex((m) => m.id === messageId);
      const userMessage = idx > 0 ? state.messages[idx - 1] : null;
      if (userMessage && userMessage.role === 'user') {
        sendMessage(userMessage.content);
      }
    },
    [state.messages, sendMessage]
  );

  const { toast } = useToast();

  const sendFeedback = useCallback(
    async (messageId: string, rating: 'thumb_up' | 'thumb_down', explanation?: string) => {
      const sessionId = getSessionId();
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
    },
    [toast, getSessionId]
  );

  return {
    messages: state.messages,
    isStreaming: state.isStreaming,
    currentStreamingId: state.currentStreamingId,
    hasActiveSession: state.hasActiveSession ?? false,
    tasksByMessage: state.tasksByMessage,
    sendMessage,
    addAssistantMessage,
    clearChat,
    endSession,
    rerunTool,
    sendFeedback,
  };
}

