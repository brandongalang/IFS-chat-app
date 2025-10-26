"use client"

import { type CSSProperties } from "react"
import { motion } from "framer-motion"
import type { UIMessage } from "ai"

import type { Message, TaskEvent } from "@/app/_shared/types/chat"
import { TaskList } from "@/components/tasks/TaskList"
import { StreamingMarkdown } from "./markdown/StreamingMarkdown"
import { cn } from "@/lib/utils"

interface EtherealMessageListProps {
  messages: Message[]
  uiMessages: UIMessage[]
  tasksByMessage: Record<string, TaskEvent[]>
  currentStreamingId?: string
}

const taskListCustomVariables = {
  '--muted-foreground': 'hsl(var(--muted-foreground))',
  '--foreground': 'hsl(var(--foreground))',
  '--secondary': 'hsl(var(--accent) / 0.18)',
  '--secondary-foreground': 'hsl(var(--foreground))',
  '--border': 'hsl(var(--border) / 0.6)',
} as const

const taskListStyleVariables = taskListCustomVariables as unknown as CSSProperties

export function EtherealMessageList({ messages, tasksByMessage, currentStreamingId }: EtherealMessageListProps) {
  return (
    <div className="flex flex-col gap-6">
      {messages.map((message) => {
        const isAssistant = message.role === "assistant"
        const isStreaming = currentStreamingId === message.id
        const containerAlign = isAssistant ? "justify-start" : "justify-end"
        const bubbleClass = cn(
          "max-w-full rounded-[28px] border px-6 py-5 shadow-lg transition-colors",
          isAssistant
            ? "bg-card/95 border-border/60 text-foreground shadow-primary/10"
            : "bg-primary/15 border-primary/30 text-foreground shadow-primary/20",
          isStreaming
            ? "ring-2 ring-primary/45"
            : undefined
        )

        const tasks = isAssistant ? tasksByMessage?.[message.id] : undefined

        return (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className={cn("flex", containerAlign)}
          >
            <div className={bubbleClass}>
              <div
                className={cn(
                  "space-y-4 text-base leading-relaxed",
                  isAssistant ? "text-foreground" : "text-foreground/90",
                )}
              >
                {isAssistant && tasks?.length ? (
                  <TaskList
                    tasks={tasks}
                    className="mb-3 rounded-2xl border border-border/60 bg-background/85 p-3 text-foreground shadow-sm"
                    itemClassName="border-border/60 bg-background/80"
                    statusClassName="text-muted-foreground"
                    progressTrackClassName="bg-accent/40"
                    progressBarClassName="bg-primary"
                    style={taskListStyleVariables}
                  />
                ) : null}

                {isAssistant ? (
                  <StreamingMarkdown text={message.content} />
                ) : (
                  <p className="whitespace-pre-wrap text-[15px] sm:text-[16px] tracking-wide text-foreground/90">
                    {message.content}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
