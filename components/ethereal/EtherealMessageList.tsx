"use client"

import { type CSSProperties } from "react"
import { motion } from "framer-motion"
import type { UIMessage } from "ai"

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

const taskListCustomVariables = {
  '--muted-foreground': '0 0% 80%',
  '--foreground': '0 0% 100%',
  '--secondary': '0 0% 100% / 0.08',
  '--secondary-foreground': '0 0% 100%',
  '--border': '0 0% 100% / 0.15',
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
          "max-w-[min(720px,85%)] rounded-[28px] border px-6 py-5 backdrop-blur-xl transition-colors",
          isAssistant
            ? "bg-white/12 border-white/18 text-white/95 shadow-[0_18px_50px_rgba(5,15,20,0.35)]"
            : "bg-white/8 border-white/12 text-white/85 shadow-[0_12px_36px_rgba(5,5,10,0.25)]",
          isStreaming && isAssistant ? "border-white/35 shadow-[0_0_42px_rgba(180,220,255,0.35)]" : undefined
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
              <div className={cn("space-y-4", isAssistant ? "text-[20px] leading-[1.4] font-light italic" : "text-sm sm:text-base leading-7 font-light")}
                style={isAssistant ? { letterSpacing: "0.015em" } : undefined}
              >
                {isAssistant && tasks?.length ? (
                  <TaskList
                    tasks={tasks}
                    className="mb-3 rounded-2xl border border-white/15 bg-white/6 p-3 text-white"
                    itemClassName="border-white/20 bg-white/12"
                    statusClassName="text-white/75"
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
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
