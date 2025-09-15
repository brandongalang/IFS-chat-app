'use client'

import { useReducer } from 'react'
import type { ChatState, Message, TaskEvent } from '@/types/chat'

const initialState: ChatState = {
  messages: [],
  isStreaming: false,
  currentStreamingId: undefined,
  hasActiveSession: false,
  tasksByMessage: {},
}

type Action =
  | { type: 'ADD_MESSAGE'; message: Message }
  | { type: 'UPDATE_MESSAGE'; id: string; updates: Partial<Message> }
  | { type: 'MERGE_STATE'; payload: Partial<ChatState> }
  | { type: 'SET_TASKS'; messageId: string; tasks: TaskEvent[] }
  | { type: 'RESET' }

function reducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] }
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map((msg) => (msg.id === action.id ? { ...msg, ...action.updates } : msg)),
      }
    case 'MERGE_STATE':
      return { ...state, ...action.payload }
    case 'SET_TASKS':
      return {
        ...state,
        tasksByMessage: { ...state.tasksByMessage, [action.messageId]: action.tasks },
        messages: state.messages.map((msg) => (msg.id === action.messageId ? { ...msg, tasks: action.tasks } : msg)),
      }
    case 'RESET':
      return { ...initialState }
    default:
      return state
  }
}

export function useChatState() {
  const [state, dispatch] = useReducer(reducer, initialState)

  const addMessage = (message: Message) => dispatch({ type: 'ADD_MESSAGE', message })
  const updateMessage = (id: string, updates: Partial<Message>) => dispatch({ type: 'UPDATE_MESSAGE', id, updates })
  const mergeState = (payload: Partial<ChatState>) => dispatch({ type: 'MERGE_STATE', payload })
  const setTasks = (messageId: string, tasks: TaskEvent[]) => dispatch({ type: 'SET_TASKS', messageId, tasks })
  const reset = () => dispatch({ type: 'RESET' })

  return { state, addMessage, updateMessage, mergeState, setTasks, reset }
}
