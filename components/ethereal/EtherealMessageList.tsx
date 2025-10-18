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
  '--muted-foreground': 'var(--muted-foreground)',
  '--foreground': 'var(--foreground)',
  '--secondary': 'var(--secondary)',
  '--secondary-foreground': 'var(--secondary-foreground)',
  '--border': 'var(--border)',
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
          "max-w-full rounded-xl border px-5 py-4 shadow-sm transition-colors",
          isAssistant
            ? "bg-card/90 border-border/50 text-foreground"
            : "bg-primary/10 border-primary/20 text-foreground",
          isStreaming && isAssistant ? "border-primary/50 shadow-md" : undefined
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
              <div className={cn("space-y-3", isAssistant ? "text-base leading-7" : "text-sm sm:text-base leading-6 font-medium text-foreground")}>
                {isAssistant && tasks?.length ? (
                  <TaskList
                    tasks={tasks}
                    className="mb-3 rounded-lg border border-border/40 bg-secondary/10 text-foreground"
                    itemClassName="border-border/40 bg-background/80 text-foreground"
                    statusClassName="text-muted-foreground"
                    progressTrackClassName="bg-secondary/30"
                    progressBarClassName="bg-primary"
                    style={taskListStyleVariables}
                  />
                ) : null}

                {isAssistant ? (
                  <StreamingMarkdown text={message.content} />
                ) : (
                  <p className="whitespace-pre-wrap text-[15px] sm:text-[16px] tracking-normal">
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
