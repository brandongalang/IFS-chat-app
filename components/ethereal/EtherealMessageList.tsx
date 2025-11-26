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
  '--muted-foreground': '0 0% 45%',
  '--foreground': '0 0% 15%',
  '--secondary': '25 100% 97%',
  '--secondary-foreground': '25 95% 40%',
  '--border': '0 0% 90%',
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
          "max-w-full rounded-[28px] border px-6 py-5 transition-colors",
          isAssistant
            ? "bg-white border-gray-200 text-gray-900 shadow-[0_4px_24px_rgba(0,0,0,0.06)]"
            : "bg-orange-50 border-orange-200 text-gray-800 shadow-[0_2px_16px_rgba(249,115,22,0.08)]",
          isStreaming && isAssistant
            ? "border-orange-300 shadow-[0_0_32px_rgba(249,115,22,0.15)] animate-softPulse"
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
              <div className={cn("space-y-4", isAssistant ? "text-[20px] leading-[1.4] font-light italic" : "text-sm sm:text-base leading-7 font-light")}
                style={isAssistant ? { letterSpacing: "0.015em" } : undefined}
              >
                {isAssistant && tasks?.length ? (
                  <TaskList
                    tasks={tasks}
                    className="mb-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 text-gray-900"
                    itemClassName="border-gray-200 bg-white"
                    statusClassName="text-gray-500"
                    progressTrackClassName="bg-gray-200"
                    progressBarClassName="bg-orange-500"
                    style={taskListStyleVariables}
                  />
                ) : null}

                {isAssistant ? (
                  <div className={cn("relative", isStreaming ? "overflow-hidden" : undefined)}>
                    {isStreaming ? (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-[-1.25rem] rounded-[32px] bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.12),rgba(249,115,22,0)_65%)] opacity-70 transition-opacity duration-500"
                      />
                    ) : null}
                    <StreamingMarkdown text={message.content} isStreaming={isStreaming} className="relative z-10" />
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-[15px] sm:text-[16px] lowercase tracking-wide text-gray-700">
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
