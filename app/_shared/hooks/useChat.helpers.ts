import { isToolOrDynamicToolUIPart, type UIMessage } from 'ai'

import { getToolDisplayCopy } from '@/app/_shared/utils/toolDisplay'
import type { Message, TaskEvent, TaskEventUpdate } from '@/types/chat'

export type UIPart = UIMessage['parts'][number]

type ToolState = 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
type ToolType = `tool-${string}`

export type ToolUIPart = UIPart & {
  toolName?: string
  toolCallId?: string
  state?: ToolState | string
  input?: unknown
  output?: unknown
  errorText?: string
  providerExecuted?: boolean
  meta?: Record<string, unknown>
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

function humanizeToolName(rawName?: string | null): string {
  if (!rawName) return 'Tool'
  const normalized = rawName
    .replace(/^tool[-:]/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalized) return 'Tool'
  return normalized
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ''))
    .join(' ')
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

function normalizeToolState(state?: string): ToolState {
  if (!state) return 'input-streaming'
  const lower = state.toLowerCase()
  if (lower === 'output-error' || lower.startsWith('error')) return 'output-error'
  if (lower === 'output-available') return 'output-available'
  if (lower.startsWith('output')) return 'input-streaming'
  if (lower === 'input-available') return 'input-available'
  if (lower === 'input-streaming' || lower.startsWith('input')) return 'input-streaming'
  return 'input-streaming'
}

function toolStateToStatus(state?: string): TaskEvent['status'] {
  if (!state) return 'working'
  const normalized = normalizeToolState(state)
  switch (normalized) {
    case 'output-available':
      return 'completed'
    case 'output-error':
      return 'failed'
    default:
      return 'working'
  }
}

function slugifyToolSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeToolType(part: ToolUIPart, index: number): ToolType {
  const rawType = typeof part.type === 'string' ? part.type : undefined
  if (rawType && rawType.startsWith('tool-')) {
    return rawType as ToolType
  }

  const rawName = typeof part.toolName === 'string' && part.toolName.trim().length > 0
    ? part.toolName
    : rawType
  if (rawName) {
    const segment = slugifyToolSegment(rawName)
    return (`tool-${segment || index}`) as ToolType
  }

  return (`tool-${index}`) as ToolType
}

export function buildToolTaskUpdate(messageId: string, part: ToolUIPart, index: number): TaskEventUpdate {
  const rawName = part.toolName ?? part.type ?? `tool-${index}`
  const id =
    typeof part.toolCallId === 'string' && part.toolCallId.length > 0
      ? part.toolCallId
      : `${messageId}-tool-${index}`

  const displayCopy = getToolDisplayCopy(part.toolName, part.type)
  const friendlyTitle = displayCopy.title || humanizeToolName(rawName)
  let status = toolStateToStatus(part.state)
  const title = humanizeToolName(rawName)
  const rawState = typeof part.state === 'string' ? part.state : undefined
  let toolState = rawState ? normalizeToolState(rawState) : undefined
  const toolType = normalizeToolType(part, index)

  const inputPreview = previewValue(part.input)
  const outputPreview = previewValue(part.output, 320)
  let errorText = typeof part.errorText === 'string' ? part.errorText : undefined
  let statusCopy = displayCopy.statusCopy

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

  if (status === 'failed' && toolState !== 'output-error') {
    toolState = 'output-error'
  }
  if (status === 'failed') {
    statusCopy = undefined
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
    if (displayCopy.note) details.push(displayCopy.note)
  }

  if (details.length === 1) {
    update.details = details[0]
  } else if (details.length > 1) {
    update.details = details
  }

  const meta: TaskEvent['meta'] = {}
  if (toolState) meta.toolState = toolState
  meta.toolType = toolType
  meta.displayTitle = friendlyTitle
  meta.displayNote = displayCopy.note
  if (!displayCopy.note && inputPreview) meta.displayNote = inputPreview
  if (statusCopy) meta.statusCopy = statusCopy
  if (typeof part.providerExecuted !== 'undefined') {
    meta.providerExecuted = part.providerExecuted
  }
  if (errorText) meta.error = errorText
  if (!meta.displayNote && outputPreview) meta.displayNote = outputPreview

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
  const statusCopy =
    typeof update.meta?.statusCopy === 'string' ? update.meta.statusCopy : ''
  const displayTitle =
    typeof update.meta?.displayTitle === 'string' ? update.meta.displayTitle : ''
  const displayNote =
    typeof update.meta?.displayNote === 'string' ? update.meta.displayNote : ''
  const metaType =
    typeof update.meta?.toolType === 'string' ? update.meta.toolType : ''
  const error =
    typeof part.errorText === 'string'
      ? part.errorText
      : typeof update.meta?.error === 'string'
      ? (update.meta.error as string)
      : ''
  return [state, status, details, metaState, statusCopy, displayTitle, displayNote, error, metaType].join('|')
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
