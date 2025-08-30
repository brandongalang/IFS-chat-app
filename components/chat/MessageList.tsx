'use client'

import { Message as MessageType } from '@/types/chat';
import { Message } from './Message';
import { MessageSquare } from 'lucide-react';

interface MessageListProps {
  messages: MessageType[];
}

export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="px-4 py-6">
        <div className="text-center py-8" data-testid="welcome-message">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2" data-testid="text-welcome-title">
            Welcome to AI Chat
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto" data-testid="text-welcome-description">
            Start a conversation with your AI assistant. Try asking about weather, calculations, or use voice input.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            <span className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm">
              &quot;weather in Seattle&quot;
            </span>
            <span className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm">
              &quot;calculate 15 * 23&quot;
            </span>
            <span className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm">
              &quot;search for AI trends&quot;
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6" data-testid="message-list">
      {messages.map((message) => (
        <Message 
          key={message.id} 
          message={message}
        />
      ))}
    </div>
  );
}
