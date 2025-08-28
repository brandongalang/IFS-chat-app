'use client'

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { VoiceInput } from './VoiceInput';
import { Send, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatComposerProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export function ChatComposer({ onSendMessage, disabled }: ChatComposerProps) {
  const [message, setMessage] = useState('');
  const [conversationTone, setConversationTone] = useState('claude');
const [isRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!message.trim() || disabled) return;
    
    onSendMessage(message.trim());
    setMessage('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceTranscript = (transcript: string) => {
    // If textarea is empty, replace content; otherwise append
    const currentValue = message.trim();
    const newValue = currentValue ? `${currentValue} ${transcript}` : transcript;
    setMessage(newValue);
    
    // Focus textarea after voice input
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`;
    }
  }, [message]);

  const charCount = message.length;
  const maxChars = 2000;
  const isOverLimit = charCount > maxChars;

  return (
    <div className="p-4">
      <div className="max-w-3xl mx-auto">
        {/* Voice Recording Indicator */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-3 flex items-center justify-center space-x-2 text-destructive"
              data-testid="voice-recording-indicator"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="w-2 h-2 bg-destructive rounded-full"
              />
              <span className="text-sm font-medium">Listening...</span>
              <span className="text-xs text-muted-foreground">Speak now or click to stop</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Composer Input */}
        <div className="space-y-3">
          {/* Text Input Area - Full Width */}
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Try 'weather in Portland' or 'calculate 15 * 23')"
              className={`min-h-[44px] max-h-32 resize-none w-full ${
                isOverLimit ? 'border-destructive' : ''
              }`}
              disabled={disabled}
              data-testid="input-message"
            />
            
            {/* Character Count */}
            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground pointer-events-none">
              <span className={isOverLimit ? 'text-destructive' : ''} data-testid="text-char-count">
                {charCount}
              </span>
              /{maxChars}
            </div>
          </div>

          {/* Button Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {/* Conversational Tone Button */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    data-testid="button-conversation-tone"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2">
                  <Select value={conversationTone} onValueChange={setConversationTone}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude" data-testid="tone-claude">
                        Claude - Thoughtful & detailed
                      </SelectItem>
                      <SelectItem value="casual" data-testid="tone-casual">
                        Casual - Friendly & relaxed
                      </SelectItem>
                      <SelectItem value="professional" data-testid="tone-professional">
                        Professional - Formal & precise
                      </SelectItem>
                      <SelectItem value="creative" data-testid="tone-creative">
                        Creative - Imaginative & expressive
                      </SelectItem>
                      <SelectItem value="concise" data-testid="tone-concise">
                        Concise - Brief & to the point
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center space-x-2">
              {/* Voice Input Button */}
              <VoiceInput 
                onTranscript={handleVoiceTranscript}
                disabled={disabled}
              />

              {/* Send Button */}
              <Button
                onClick={handleSend}
                disabled={disabled || !message.trim() || isOverLimit}
                size="icon"
                data-testid="button-send"
                className="flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Input Helpers */}
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <div className="flex items-center space-x-4">
            <span data-testid="text-input-help">
              Press Enter to send, Shift+Enter for new line
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="hidden md:inline" data-testid="text-voice-status">
              Voice input available
            </span>
            <div className="w-2 h-2 bg-accent rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
