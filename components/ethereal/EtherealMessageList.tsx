"use client"

import { useMemo, type CSSProperties } from "react"
import { motion } from "framer-motion"
import type { UIMessage } from "ai"
import { isToolOrDynamicToolUIPart } from "ai"

import type { Message, TaskEvent } from "@/app/_shared/types/chat"
import { TaskList } from "@/components/tasks/TaskList"
import { StreamingText } from "./StreamingText"
import { cn } from "@/lib/utils"

interface EtherealMessageListProps {
  messages: Message[]
  uiMessages: UIMessage[]
  tasksByMessage: Record<string, TaskEvent[]>
  currentStreamingId?: string
}

interface ToolActivity {
  key: string
  name: string
  displayName: string
  state: string
  inputPreview?: string
  outputPreview?: string
  errorText?: string
  isMemory: boolean
}

function formatPreview(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return undefined
  }
}

function truncate(text: string | undefined, limit = 160): string | undefined {
  if (!text) return undefined
  if (text.length <= limit) return text
  return `${text.slice(0, limit - 1).trimEnd()}…`
}

function extractToolActivities(message: UIMessage | undefined): ToolActivity[] {
  if (!message?.parts) return []

  const activities: ToolActivity[] = []

  message.parts.forEach((part, index) => {
    if (!isToolOrDynamicToolUIPart(part)) return

    const toolPart = part as typeof part & {
      toolName?: string
      toolCallId?: string
      state?: string
      input?: unknown
      output?: unknown
      errorText?: string
    }

    const rawName = toolPart.toolName ?? toolPart.toolCallId ?? toolPart.type ?? `tool-${index}`
    const normalized = rawName.replace(/^tool[-:]/i, "")
    const displayName = normalized.replace(/[-_]/g, " ").trim() || "tool"
    const state = toolPart.state ?? "unknown"

    const inputPreview = truncate(formatPreview(toolPart.input))
    const outputPreview = truncate(formatPreview(toolPart.output), 220)
    const errorText = truncate(toolPart.errorText)

    const isMemory = /memory|note/i.test(`${toolPart.toolName ?? ""} ${part.type ?? ""}`)

    activities.push({
      key: `${message.id}-${toolPart.toolCallId ?? index}`,
      name: rawName,
      displayName,
      state,
      inputPreview,
      outputPreview,
      errorText,
      isMemory,
    })
  })

  return activities
}

function statusLabel(state: string, isMemory: boolean): string {
  switch (state) {
    case "input-streaming":
    case "input-available":
      return isMemory ? "reviewing your notes" : "gathering context"
    case "output-streaming":
      return isMemory ? "writing new notes" : "preparing results"
    case "output-available":
      return isMemory ? "notes ready" : "result available"
    case "output-error":
      return "tool error"
    default:
      return "processing"
  }
}

const taskListCustomVariables = {
  '--muted-foreground': '0 0% 80%',
  '--foreground': '0 0% 100%',
  '--secondary': '0 0% 100% / 0.08',
  '--secondary-foreground': '0 0% 100%',
  '--border': '0 0% 100% / 0.15',
} as const

const taskListStyleVariables = taskListCustomVariables as unknown as CSSProperties

function ToolActivityCard({ activity }: { activity: ToolActivity }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/6 p-4 text-white/80 shadow-[0_12px_32px_rgba(0,0,0,0.25)]">
      <div className="flex items-baseline justify-between gap-3 text-[11px] uppercase tracking-[0.2em] text-white/60">
        <span>{activity.isMemory ? "memory" : activity.displayName}</span>
        <span className="text-white/70">{statusLabel(activity.state, activity.isMemory)}</span>
      </div>
      {activity.inputPreview ? (
        <p className="mt-3 whitespace-pre-wrap text-xs/relaxed text-white/70">
          {activity.inputPreview}
        </p>
      ) : null}
      {activity.outputPreview ? (
        <p className="mt-3 whitespace-pre-wrap text-sm/relaxed text-white/85">
          {activity.outputPreview}
        </p>
      ) : null}
      {activity.errorText ? (
        <p className="mt-3 rounded-md border border-red-300/40 bg-red-400/15 px-3 py-2 text-xs text-red-100/90">
          {activity.errorText}
        </p>
      ) : null}
    </div>
  )
}

export function EtherealMessageList({ messages, uiMessages, tasksByMessage, currentStreamingId }: EtherealMessageListProps) {
  const uiById = useMemo(() => new Map(uiMessages.map((msg) => [msg.id, msg])), [uiMessages])

  return (
    <div className="flex flex-col gap-6">
      {messages.map((message) => {
        const isAssistant = message.role === "assistant"
        const isStreaming = currentStreamingId === message.id
        const containerAlign = isAssistant ? "justify-start" : "justify-end"
        const bubbleClass = cn(
          "max-w-[min(720px,85%)] rounded-[28px] border px-6 py-5 backdrop-blur-xl transition-colors",
          isAssistant
            ? "bg-white/12 border-white/18 text-white/95 shadow-[0_18px_50px_rgba(5,15,20,0.35)]"
            : "bg-white/8 border-white/12 text-white/85 shadow-[0_12px_36px_rgba(5,5,10,0.25)]",
          isStreaming && isAssistant ? "border-white/35 shadow-[0_0_42px_rgba(180,220,255,0.35)]" : undefined
        )

        const tasks = isAssistant ? tasksByMessage?.[message.id] : undefined
        const uiMessage = uiById.get(message.id)
        const toolActivities = isAssistant ? extractToolActivities(uiMessage) : []
        const showToolActivities = isAssistant && toolActivities.length > 0 && (!tasks || tasks.length === 0)

        return (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className={cn("flex", containerAlign)}
          >
            <div className={bubbleClass}>
              <div className={cn("space-y-4", isAssistant ? "text-[20px] leading-[1.4] font-light italic" : "text-sm sm:text-base leading-7 font-light")}
                style={isAssistant ? { letterSpacing: "0.015em" } : undefined}
              >
                {isAssistant && tasks?.length ? (
                  <TaskList
                    tasks={tasks}
                    className="mb-3 space-y-2 rounded-2xl border border-white/15 bg-white/6 p-3 text-white"
                    progressTrackClassName="bg-white/20"
                    progressBarClassName="bg-white"
                    style={taskListStyleVariables}
                  />
                ) : null}

                {isAssistant ? (
                  <StreamingText text={message.content} />
                ) : (
                  <p className="whitespace-pre-wrap text-[15px] sm:text-[16px] lowercase tracking-wide text-white/90">
                    {message.content}
                  </p>
                )}

                {showToolActivities
                  ? (
                      <div className="space-y-3">
                        {toolActivities.map((activity) => (
                          <ToolActivityCard key={activity.key} activity={activity} />
                        ))}
                      </div>
                    )
                  : null}
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
