'use client'

import { useState } from 'react';
import { MessageList } from './MessageList';
import { ChatComposer } from './ChatComposer';
import { useChat } from '@/hooks/useChat';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Settings, MessageSquare, Trash2 } from 'lucide-react';

export function ChatLayout() {
  const [isDark, setIsDark] = useState(false);
  const { messages, isStreaming, sendMessage, clearChat, rerunTool } = useChat();

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-lg" data-testid="chat-title">AI Assistant</h1>
            <p className="text-muted-foreground text-xs" data-testid="chat-subtitle">
              Powered by Vercel AI SDK
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            data-testid="button-theme-toggle"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Moon className="w-4 h-4 text-muted-foreground" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={clearChat}
            disabled={messages.length === 0}
            data-testid="button-clear-chat"
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            data-testid="button-settings"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <MessageList 
          messages={messages} 
          onRerunTool={rerunTool}
          data-testid="messages-container" 
        />
      </div>

      {/* Composer */}
      <div className="bg-card border-t border-border">
        <ChatComposer 
          onSendMessage={sendMessage} 
          disabled={isStreaming}
          data-testid="chat-composer" 
        />
      </div>
    </div>
  );
}
