'use client'

import { useSessionChat } from '../../hooks/useSessionChat'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '../../components/ai-elements/conversation'
import {
  Message,
  MessageContent,
} from '../../components/ai-elements/message'
import { Response } from '../../components/ai-elements/response'
import { Reasoning, ReasoningContent, ReasoningTrigger } from '../../components/ai-elements/reasoning'
import {
  Actions,
  ActionsContent,
  ActionsTrigger,
} from '../../components/ai-elements/actions'
import { Loader } from '../../components/ai-elements/loader'
import { PromptInput, PromptInputTextarea, PromptInputToolbar, PromptInputTools, PromptInputSubmit } from '../../components/ai-elements/prompt-input'

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, status } = useSessionChat()

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      <header className="p-4 border-b">
        <h1 className="text-2xl font-bold">IFS Therapy Companion</h1>
        <p className="text-muted-foreground">Your Internal Family Systems therapy companion</p>
      </header>
      
      <div className="flex-1 overflow-hidden">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.map((message: any) => (
              <div key={message.id}>
                <Message from={message.role}>
                  <MessageContent>
                    {Array.isArray(message.parts)
                      ? message.parts.map((part: any, i: number) => {
                          switch (part.type) {
                            case 'text':
                              return <Response key={`${message.id}-${i}`}>{part.text}</Response>
                            case 'reasoning':
                              return (
                                <Reasoning key={`${message.id}-${i}`} className="w-full" isStreaming={status === 'streaming'}>
                                  <ReasoningTrigger />
                                  <ReasoningContent>{part.text}</ReasoningContent>
                                </Reasoning>
                              )
                            case 'tool-call':
                              return (
                                <Actions key={`${message.id}-${i}`} className="w-full">
                                  <ActionsTrigger />
                                  <ActionsContent>
                                    <p>Tool Call: {part.toolName}</p>
                                    <pre>{JSON.stringify(part.args, null, 2)}</pre>
                                  </ActionsContent>
                                </Actions>
                              );
                            case 'tool-result':
                              return (
                                <Actions key={`${message.id}-${i}`} className="w-full">
                                  <ActionsTrigger />
                                  <ActionsContent>
                                    <p>Tool Result: {part.toolName}</p>
                                    <pre>{JSON.stringify(part.result, null, 2)}</pre>
                                  </ActionsContent>
                                </Actions>
                              )
                            default:
                              return null
                          }
                        })
                      : <Response>{(message as any).content || ''}</Response>}
                  </MessageContent>
                </Message>
              </div>
            ))}
            {status === 'submitted' && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>
      
      <div className="p-2 text-xs text-muted-foreground h-5">
        {status === 'submitted' && 'Preparing response…'}
        {status === 'streaming' && 'Looking for parts…'}
      </div>

      <PromptInput onSubmit={handleSubmit} className="p-4 border-t">
        <PromptInputTextarea
          value={input || ''}
          onChange={handleInputChange}
          placeholder="Share what's on your mind..."
          disabled={isLoading}
        />
        <PromptInputToolbar>
          <PromptInputTools />
          <PromptInputSubmit type="submit" disabled={isLoading || !input?.trim()}>
            {isLoading ? 'Sending…' : 'Send'}
          </PromptInputSubmit>
        </PromptInputToolbar>
      </PromptInput>
    </div>
  )
}