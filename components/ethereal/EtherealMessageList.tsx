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
  '--muted-foreground': '0 0% 80%',
  '--foreground': '0 0% 100%',
  '--secondary': '0 0% 100% / 0.08',
  '--secondary-foreground': '0 0% 100%',
  '--border': '0 0% 100% / 0.15',
} as const

const taskListStyleVariables = taskListCustomVariables as unknown as CSSProperties

export function EtherealMessageList({ messages, tasksByMessage, currentStreamingId }: EtherealMessageListProps) {
  return (
    <main className="flex-1 overflow-y-auto p-4 space-y-6">
      {messages.map((message) => {
        const isAssistant = message.role === "assistant"
        const isStreaming = currentStreamingId === message.id
        const senderLabel = isAssistant ? "The Critic" : "Me" // TODO: Get actual part name for assistant messages

        const tasks = isAssistant ? tasksByMessage?.[message.id] : undefined

        return (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className={cn("flex items-end gap-3", isAssistant ? "justify-start" : "justify-end")}
          >
            <div className="flex flex-1 flex-col gap-1" style={{ maxWidth: '360px' }}>
              <p className={cn(
                "text-[13px] font-normal leading-normal",
                isAssistant
                  ? "text-secondary-text-light dark:text-secondary-text-dark text-left"
                  : "text-secondary-text-light dark:text-secondary-text-dark text-right"
              )}>
                {senderLabel}
              </p>
              <div className={cn(
                "rounded-xl px-4 py-3 shadow-soft",
                isAssistant
                  ? "bg-card-light dark:bg-card-dark"
                  : "bg-primary dark:bg-primary"
              )}>
                <div className={cn(
                  "text-base font-normal leading-normal",
                  isAssistant
                    ? "text-text-primary-light dark:text-text-primary-dark"
                    : "text-white"
                )}>
                  {isAssistant && tasks?.length ? (
                    <TaskList
                      tasks={tasks}
                      className="mb-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3"
                      itemClassName="border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700"
                      statusClassName="text-gray-600 dark:text-gray-300"
                      progressTrackClassName="bg-gray-200 dark:bg-gray-600"
                      progressBarClassName="bg-primary dark:bg-primary"
                    />
                  ) : null}

                  {isAssistant ? (
                    <div className={cn("relative", isStreaming ? "overflow-hidden" : undefined)}>
                      {isStreaming ? (
                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-[-1.25rem] rounded-[32px] bg-[radial-gradient(circle_at_top,rgba(124,154,146,0.2),rgba(124,154,146,0)_65%)] opacity-70 transition-opacity duration-500"
                        />
                      ) : null}
                      <StreamingMarkdown text={message.content} isStreaming={isStreaming} className="relative z-10" />
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">
                      {message.content}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )
      })}
    </main>
  )
}
