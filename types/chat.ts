export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  persona?: 'claude' | 'default';
  tool?: ToolCall;
  streaming?: boolean;
}

export interface ToolCall {
  name: string;
  summary: string;
  inputs?: Record<string, any>;
  details?: string;
  rawJson?: any;
}

export interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  currentStreamingId?: string;
}

export interface MockAIClient {
  streamMessage: (params: {
    messages: Message[];
    onToken: (token: string, isComplete: boolean) => void;
  }) => { cancel: () => void };
}
