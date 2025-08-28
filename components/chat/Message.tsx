'use client'

import { Message as MessageType } from '@/types/chat';
import { User, Bot } from 'lucide-react';
import { motion } from 'framer-motion';
import { TaskList } from './TaskList';

interface MessageProps {
  message: MessageType;
  onRerunTool: (messageId: string) => void;
}

export function Message({ message, onRerunTool }: MessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-start space-x-3 justify-end"
        data-testid={`message-user-${message.id}`}
      >
        <div className="bg-primary text-primary-foreground px-4 py-3 rounded-lg max-w-xs md:max-w-md lg:max-w-lg">
          <p className="whitespace-pre-wrap" data-testid={`text-message-${message.id}`}>
            {message.content}
          </p>
          <div className="flex items-center justify-end mt-2 text-xs opacity-70">
            <span data-testid={`text-timestamp-${message.id}`}>
              {formatTime(message.timestamp)}
            </span>
          </div>
        </div>
        <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-secondary-foreground" />
        </div>
      </motion.div>
    );
  }

  if (isAssistant) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-start space-x-3"
        data-testid={`message-assistant-${message.id}`}
      >
        <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-accent-foreground" />
        </div>
        <div className="flex-1 max-w-xs md:max-w-md lg:max-w-lg">
          {/* Task List (server-driven) */}
          {message.tasks && message.tasks.length > 0 && (
            <div className="mb-3">
              <TaskList tasks={message.tasks} />
            </div>
          )}

          {/* Assistant Message Bubble */}
          <div className="bg-card border border-border px-4 py-3 rounded-lg shadow-sm">
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap" data-testid={`text-message-${message.id}`}>
                {message.content}
                {message.streaming && (
                  <span className="inline-flex items-center ml-2">
                    <span className="animate-pulse">▊</span>
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center mt-3 text-xs text-muted-foreground">
              <span data-testid={`text-timestamp-${message.id}`}>
                {formatTime(message.timestamp)}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return null;
}
