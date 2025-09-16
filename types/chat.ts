export interface TaskEvent {
  id: string;
  title: string;
  status: 'pending' | 'working' | 'completed' | 'failed' | 'canceled';
  progress?: number;
  details?: string | string[];
  meta?: {
    files?: Array<{ name: string }>
    [key: string]: unknown;
  };
}

export type TaskEventUpdate = Partial<TaskEvent> & { id: string };

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  persona?: 'claude' | 'default';
  streaming?: boolean;
  tasks?: TaskEvent[]; // server-driven tasks for this assistant message
}

export interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  currentStreamingId?: string;
  hasActiveSession?: boolean;
  // Map assistant message id -> list of task events
  tasksByMessage?: Record<string, TaskEvent[]>;
}

