'use client'

import { useState, useCallback, useRef } from 'react';
import { Message, ChatState, ToolCall } from '@/types/chat';
import { mockAIClient } from '@/lib/mockAIClient';
import { detectTool } from '@/lib/toolDetection';

export function useChat() {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isStreaming: false,
    currentStreamingId: undefined
  });

  const streamingCancelRef = useRef<(() => void) | null>(null);

  const generateId = (): string => {
    return Math.random().toString(36).substr(2, 9);
  };

  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: generateId(),
      timestamp: Date.now()
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, newMessage]
    }));

    return newMessage.id;
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(msg => 
        msg.id === id ? { ...msg, ...updates } : msg
      )
    }));
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || state.isStreaming) return;

    // Cancel any ongoing streaming
    if (streamingCancelRef.current) {
      streamingCancelRef.current();
    }

    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now()
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage]
    }));

    // Detect tool for the assistant response
    const tool = detectTool(content);

    // Create assistant message
    const assistantId = generateId();
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      persona: 'claude',
      tool: tool || undefined,
      streaming: true
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, assistantMessage],
      isStreaming: true,
      currentStreamingId: assistantId
    }));

    // Start streaming response
    const { cancel } = mockAIClient.streamMessage({
      messages: [...state.messages, userMessage],
      onToken: (token: string, isComplete: boolean) => {
        updateMessage(assistantId, {
          content: token,
          streaming: !isComplete
        });

        if (isComplete) {
          setState(prev => ({
            ...prev,
            isStreaming: false,
            currentStreamingId: undefined
          }));
          streamingCancelRef.current = null;
        }
      }
    });

    streamingCancelRef.current = cancel;
  }, [state.messages, state.isStreaming, updateMessage]);

  const clearChat = useCallback(() => {
    if (streamingCancelRef.current) {
      streamingCancelRef.current();
    }
    setState({
      messages: [],
      isStreaming: false,
      currentStreamingId: undefined
    });
  }, []);

  const rerunTool = useCallback((messageId: string) => {
    const message = state.messages.find(m => m.id === messageId);
    if (!message || !message.tool) return;

    // Find the previous user message to re-trigger the tool
    const messageIndex = state.messages.findIndex(m => m.id === messageId);
    const userMessage = messageIndex > 0 ? state.messages[messageIndex - 1] : null;
    
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
    rerunTool
  };
}
