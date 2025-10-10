import { isToolOrDynamicToolUIPart, type UIMessage } from 'ai'

import { friendlyToolLabel } from '@/components/ai-elements/tool'
import type { Message, TaskEvent, TaskEventUpdate } from '@/types/chat'

export type UIPart = UIMessage['parts'][number]

export type ToolUIPart = UIPart & {
  toolName?: string
  toolCallId?: string
  state?: string
  input?: unknown
  output?: unknown
  errorText?: string
  providerExecuted?: boolean
}

export function isDataUIPart(part: UIPart): part is UIPart & { type: `data-${string}`; data: unknown } {
  return typeof part?.type === 'string' && part.type.startsWith('data-') && 'data' in part
}

export function getToolOutput(part: UIPart): string {
  if (!isToolOrDynamicToolUIPart(part)) return ''
  if (part.state !== 'output-available') return ''
  const output = (part as typeof part & { output?: unknown }).output
  return typeof output === 'string' ? output : ''
}

function previewValue(value: unknown, limit = 280): string | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return undefined
    return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  try {
    const serialized = JSON.stringify(value, null, 2)
    if (!serialized) return undefined
    return serialized.length > limit ? `${serialized.slice(0, limit - 1).trimEnd()}…` : serialized
  } catch {
    return undefined
  }
}

function toolStateToStatus(state?: string): TaskEvent['status'] {
  if (!state) return 'working'
  if (state.startsWith('input')) return 'working'
  if (state === 'output-available') return 'completed'
  if (state === 'output-error' || state.startsWith('error')) return 'failed'
  if (state.startsWith('output')) return 'working'
  return 'working'
}

export function buildToolTaskUpdate(messageId: string, part: ToolUIPart, index: number): TaskEventUpdate {
  const rawName = part.toolName ?? part.type ?? `tool-${index}`
  const id =
    typeof part.toolCallId === 'string' && part.toolCallId.length > 0
      ? part.toolCallId
      : `${messageId}-tool-${index}`

  let status = toolStateToStatus(part.state)
  const title = friendlyToolLabel(rawName)
  const toolState = typeof part.state === 'string' ? part.state : undefined

  const inputPreview = previewValue(part.input)
  const outputPreview = previewValue(part.output, 320)
  let errorText = typeof part.errorText === 'string' ? part.errorText : undefined

  if (!errorText && part.output && typeof part.output === 'object') {
    const outputObj = part.output as Record<string, unknown>
    const successValue = outputObj?.success
    if (typeof successValue === 'boolean' && successValue === false) {
      status = 'failed'
      const outputError = outputObj.error
      if (typeof outputError === 'string' && outputError.trim().length > 0) {
        errorText = outputError.trim()
      }
    }
  }

  const update: TaskEventUpdate = {
    id,
    title,
    status,
  }

  const details: string[] = []
  if (errorText) {
    details.push(errorText)
  } else {
    if (outputPreview) details.push(outputPreview)
    if (inputPreview && inputPreview !== outputPreview) {
      details.push(`Input preview: ${inputPreview}`)
    }
  }

  if (details.length === 1) {
    update.details = details[0]
  } else if (details.length > 1) {
    update.details = details
  }

  const meta: TaskEvent['meta'] = {}
  if (toolState) meta.toolState = toolState
  if (inputPreview) meta.inputPreview = inputPreview
  if (outputPreview) meta.outputPreview = outputPreview
  if (typeof part.providerExecuted !== 'undefined') {
    meta.providerExecuted = part.providerExecuted
  }
  if (errorText) meta.error = errorText

  if (Object.keys(meta).length > 0) {
    update.meta = meta
  }

  return update
}

export function signatureForToolUpdate(part: ToolUIPart, update: TaskEventUpdate): string {
  const state = typeof part.state === 'string' ? part.state : ''
  const status = update.status ?? ''
  const details =
    Array.isArray(update.details) ? update.details.join('||') : update.details ?? ''
  const metaState =
    typeof update.meta?.toolState === 'string' ? update.meta.toolState : ''
  const inputPreview =
    typeof update.meta?.inputPreview === 'string' ? update.meta.inputPreview : ''
  const outputPreview =
    typeof update.meta?.outputPreview === 'string' ? update.meta.outputPreview : ''
  const error =
    typeof part.errorText === 'string'
      ? part.errorText
      : typeof update.meta?.error === 'string'
      ? (update.meta.error as string)
      : ''
  return [state, status, details, metaState, inputPreview, outputPreview, error].join('|')
}

export function signatureForTaskUpdate(update: TaskEventUpdate): string {
  const title = update.title ?? ''
  const status = update.status ?? ''
  const progress =
    typeof update.progress === 'number' && Number.isFinite(update.progress)
      ? String(update.progress)
      : ''
  const details =
    Array.isArray(update.details) ? update.details.join('||') : update.details ?? ''
  const meta = update.meta ? JSON.stringify(update.meta) : ''
  return [title, status, progress, details, meta].join('|')
}

const messageTimestamps: Record<string, number> = {}

export function extractText(message: UIMessage): string {
  return message.parts
    .map((part) => {
      if (part?.type === 'text' || part?.type === 'reasoning') {
        return part.text
      }
      const toolOutput = getToolOutput(part)
      if (toolOutput) return toolOutput
      if (isDataUIPart(part) && typeof part.data === 'string') {
        return part.data
      }
      return ''
    })
    .join('')
    .trim()
}

export function isAssistantStreaming(message: UIMessage): boolean {
  if (message.role !== 'assistant') return false
  return message.parts.some((part) => {
    if (part?.type === 'text' || part?.type === 'reasoning') {
      return part.state === 'streaming'
    }
    if (isToolOrDynamicToolUIPart(part)) {
      return part.state === 'input-streaming'
    }
    return false
  })
}

export function toBasicMessage(message: UIMessage): Message {
  if (!messageTimestamps[message.id]) {
    messageTimestamps[message.id] = Date.now()
  }
  return {
    id: message.id,
    role: message.role === 'assistant' || message.role === 'system' ? 'assistant' : 'user',
    content: extractText(message),
    timestamp: messageTimestamps[message.id],
    persona: message.role === 'assistant' ? 'claude' : undefined,
    streaming: isAssistantStreaming(message),
    tasks: [],
  }
}

export function resetMessageTimestamps(): void {
  for (const key of Object.keys(messageTimestamps)) {
    delete messageTimestamps[key]
  }
}

export function createTextUiMessage(id: string, role: 'assistant' | 'user', text: string): UIMessage {
  return {
    id,
    role,
    parts: [
      {
        type: 'text',
        text,
      },
    ],
  }
}
