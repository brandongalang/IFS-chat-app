'use client'

import { useState } from 'react';
import { Message as MessageType } from '@/types/chat';
import { User, Bot, ThumbsUp, ThumbsDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { TaskList } from './TaskList';
import { Actions, Action } from '../ai-elements/actions';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { useChat } from '@/hooks/useChat'; // Import useChat

interface MessageProps {
  message: MessageType;
}

export function Message({ message }: MessageProps) {
  const { sendFeedback } = useChat(); // Get sendFeedback from the hook
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const [rating, setRating] = useState<'thumb_up' | 'thumb_down' | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');

  const handleRating = (newRating: 'thumb_up' | 'thumb_down') => {
    const newSelectedRating = rating === newRating ? null : newRating;
    setRating(newSelectedRating);
    // If user selects a rating, and there's no text, open the popover
    if (newSelectedRating && !feedbackText) {
      setPopoverOpen(true);
    }
    // If user deselects a rating, close the popover
    if (!newSelectedRating) {
      setPopoverOpen(false);
    }
  };

  const handleSubmitFeedback = () => {
    if (!rating) return;
    sendFeedback(message.id, rating, feedbackText);
    setPopoverOpen(false);
    setFeedbackText('');
    // Keep the rating selected to show it has been submitted
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
        <div className="flex-1 max-w-xs md:max-w-md lg:max-w-lg group relative">
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
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-muted-foreground" data-testid={`text-timestamp-${message.id}`}>
                {formatTime(message.timestamp)}
              </span>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <Actions>
                    <Action
                        tooltip="Good response"
                        onClick={() => handleRating('thumb_up')}
                    >
                        <ThumbsUp className={`w-4 h-4 ${rating === 'thumb_up' ? 'text-blue-500' : ''}`} />
                    </Action>
                    <Action
                        tooltip="Bad response"
                        onClick={() => handleRating('thumb_down')}
                    >
                        <ThumbsDown className={`w-4 h-4 ${rating === 'thumb_down' ? 'text-red-500' : ''}`} />
                    </Action>
                    {rating && (
                        <PopoverTrigger asChild>
                            <Button variant="link" size="sm" className="text-xs h-auto px-1 py-0">
                                Add feedback
                            </Button>
                        </PopoverTrigger>
                    )}
                  </Actions>
                  <PopoverContent className="w-80">
                      <div className="grid gap-4">
                          <div className="space-y-2">
                              <h4 className="font-medium leading-none">Provide additional feedback</h4>
                              <p className="text-sm text-muted-foreground">
                                  What did you {rating === 'thumb_up' ? 'like' : 'dislike'} about this response?
                              </p>
                          </div>
                          <div className="grid gap-2">
                              <Textarea
                                  value={feedbackText}
                                  onChange={(e) => setFeedbackText(e.target.value)}
                                  placeholder="Your feedback..."
                              />
                              <Button onClick={handleSubmitFeedback}>Submit</Button>
                          </div>
                      </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return null;
}
