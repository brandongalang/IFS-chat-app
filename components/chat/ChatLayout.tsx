'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation'
import { MessageList } from './MessageList';
import { ChatComposer } from './ChatComposer';
import { useChat } from '@/hooks/useChat';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription } from '@/components/ui/alert-dialog'
import { Moon, Sun, Settings, MessageSquare, Trash2, ArrowLeft } from 'lucide-react';

export function ChatLayout() {
  const router = useRouter()
  const [isDark, setIsDark] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { messages, isStreaming, sendMessage, clearChat, rerunTool, hasActiveSession, endSession } = useChat();

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const handleBack = async () => {
    if (hasActiveSession) {
      setConfirmOpen(true)
    } else {
      router.push('/')
    }
  }

  const confirmEndAndGoHome = async () => {
    await endSession()
    setConfirmOpen(false)
    router.push('/')
  }

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="icon" onClick={handleBack} aria-label="Back to Home" data-testid="button-back-home">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </Button>
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-lg" data-testid="chat-title">Self Guide</h1>
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

      {/* Confirm end session dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End current session?</AlertDialogTitle>
            <AlertDialogDescription>
              Going back to Home will end your current chat session. You can always start a new session later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEndAndGoHome} data-testid="confirm-end-session">End session</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
