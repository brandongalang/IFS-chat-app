export type ToolActivityEntry = {
  id: string
  text: string
  status: TaskEvent['status']
  timestamp: number
  toolTitle?: string
}

export interface TaskEventMeta {
  files?: Array<{ name: string }>
  toolType?: string
  toolState?: string
  displayTitle?: string
  displayNote?: string
  statusCopy?: string
  error?: string
  providerExecuted?: boolean
  activityLog?: ToolActivityEntry[]
  lastUpdated?: number
  [key: string]: unknown
}

export interface TaskEvent {
  id: string
  title: string
  status: 'pending' | 'working' | 'completed' | 'failed' | 'canceled'
  progress?: number
  details?: string | string[]
  meta?: TaskEventMeta
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
  isLoading: boolean;
  isStreaming?: boolean;
  currentStreamingId?: string;
  hasActiveSession?: boolean;
  // Map assistant message id -> list of task events
  tasksByMessage?: Record<string, TaskEvent[]>;
}
