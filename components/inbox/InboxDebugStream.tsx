'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useInboxGenerateStream, type StreamEvent } from '@/hooks/useInboxGenerateStream'
import { cn } from '@/lib/utils'

function getEventColor(event: string): string {
  switch (event) {
    case 'status':
      return 'text-blue-500'
    case 'tool_call':
      return 'text-purple-500'
    case 'tool_result':
      return 'text-green-500'
    case 'text_delta':
      return 'text-gray-400'
    case 'error':
      return 'text-red-500'
    case 'done':
      return 'text-emerald-500'
    case 'queue':
    case 'history':
      return 'text-cyan-500'
    case 'parsed':
      return 'text-amber-500'
    default:
      return 'text-gray-500'
  }
}

function getEventIcon(event: string): string {
  switch (event) {
    case 'status':
      return '●'
    case 'tool_call':
      return '→'
    case 'tool_result':
      return '←'
    case 'text_delta':
      return '·'
    case 'error':
      return '✕'
    case 'done':
      return '✓'
    case 'queue':
      return '📥'
    case 'history':
      return '📜'
    case 'parsed':
      return '📦'
    default:
      return '○'
  }
}

function EventRow({ event }: { event: StreamEvent }) {
  const [expanded, setExpanded] = useState(false)
  const color = getEventColor(event.event)
  const icon = getEventIcon(event.event)

  // Format the data for display
  const summary = (() => {
    switch (event.event) {
      case 'status':
        return event.data.type as string
      case 'tool_call':
        return `${event.data.toolName}(${JSON.stringify(event.data.args).substring(0, 50)}...)`
      case 'tool_result':
        return `${event.data.toolName} returned`
      case 'text_delta':
        return (event.data.text as string)?.substring(0, 80) || ''
      case 'error':
        return event.data.message as string
      case 'done':
        return `${event.data.status} - ${event.data.toolCallCount ?? 0} tool calls, ${event.data.itemCount ?? 0} items`
      case 'queue':
        return `${event.data.available}/${event.data.limit} slots available`
      case 'history':
        return `${event.data.count} recent items`
      case 'parsed':
        return `${event.data.itemCount} items parsed`
      default:
        return JSON.stringify(event.data).substring(0, 80)
    }
  })()

  return (
    <div className="border-b border-border/30 py-1.5">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left flex items-start gap-2 hover:bg-muted/30 px-1 rounded"
      >
        <span className={cn('font-mono text-xs', color)}>{icon}</span>
        <span className={cn('font-mono text-xs font-medium min-w-[80px]', color)}>
          {event.event}
        </span>
        <span className="font-mono text-xs text-foreground/70 truncate flex-1">
          {summary}
        </span>
      </button>
      {expanded && (
        <pre className="mt-1 ml-6 p-2 bg-muted/50 rounded text-xs overflow-auto max-h-40">
          {JSON.stringify(event.data, null, 2)}
        </pre>
      )}
    </div>
  )
}

export function InboxDebugStream() {
  const { events, isStreaming, error, startStream, clearEvents } = useInboxGenerateStream()
  const [open, setOpen] = useState(false)

  const toolCalls = events.filter((e) => e.event === 'tool_call')
  const doneEvent = events.find((e) => e.event === 'done')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-xs font-medium text-[var(--hs-text-tertiary)] hover:text-[var(--hs-primary)]"
          title="Debug inbox generation"
        >
          Debug
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Inbox Generation Debug</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4">
          <Button
            onClick={startStream}
            disabled={isStreaming}
            size="sm"
          >
            {isStreaming ? 'Streaming...' : 'Start Stream'}
          </Button>
          <Button
            onClick={clearEvents}
            variant="outline"
            size="sm"
            disabled={isStreaming}
          >
            Clear
          </Button>
          {events.length > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              {events.length} events | {toolCalls.length} tool calls
            </span>
          )}
        </div>

        {error && (
          <div className="mb-4 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {doneEvent && (
          <div className={cn(
            'mb-4 p-2 rounded text-sm',
            doneEvent.data.status === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
              : doneEvent.data.status === 'skipped'
                ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
          )}>
            <strong>Result:</strong> {doneEvent.data.status as string}
            {doneEvent.data.reason ? ` (${doneEvent.data.reason as string})` : null}
            {' | '}
            {doneEvent.data.toolCallCount as number ?? 0} tool calls
            {' | '}
            {doneEvent.data.itemCount as number ?? 0} items generated
          </div>
        )}

        <ScrollArea className="h-[400px] border rounded">
          <div className="p-2">
            {events.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Click &quot;Start Stream&quot; to begin debugging
              </div>
            ) : (
              events.map((event, i) => (
                <EventRow key={`${event.timestamp}-${i}`} event={event} />
              ))
            )}
          </div>
        </ScrollArea>

        <div className="mt-4 text-xs text-muted-foreground">
          <strong>Legend:</strong>{' '}
          <span className="text-purple-500">→ tool_call</span>{' '}
          <span className="text-green-500">← tool_result</span>{' '}
          <span className="text-blue-500">● status</span>{' '}
          <span className="text-red-500">✕ error</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
