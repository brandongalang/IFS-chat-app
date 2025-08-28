export interface TaskEvent {
  id: string;
  title: string;
  status: 'pending' | 'working' | 'completed' | 'failed' | 'canceled';
  progress?: number;
  details?: string | string[];
  meta?: any;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  persona?: 'claude' | 'default';
  tool?: ToolCall; // deprecated: replaced by server-driven TaskEvent UI
  streaming?: boolean;
  tasks?: TaskEvent[]; // server-driven tasks for this assistant message
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
  hasActiveSession?: boolean;
  // Map assistant message id -> list of task events
  tasksByMessage?: Record<string, TaskEvent[]>;
}

export interface MockAIClient {
  streamMessage: (params: {
    messages: Message[];
    onToken: (token: string, isComplete: boolean) => void;
  }) => { cancel: () => void };
}
