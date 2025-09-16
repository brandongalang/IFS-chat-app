"use client"

import { useMemo, type CSSProperties } from "react"
import { motion } from "framer-motion"

import { TaskList } from "@/components/chat/TaskList"
import { StreamingText } from "./StreamingText"
import type { Message as ChatMessageType, TaskEvent } from "@/types/chat"

interface ChatMessageProps {
  message: ChatMessageType
  isActive: boolean
  tasks?: TaskEvent[]
  taskListStyles: CSSProperties
}

export function ChatMessage({ message, isActive, tasks, taskListStyles }: ChatMessageProps) {
  const isAssistant = message.role === "assistant"

  const userOpacity = useMemo(() => {
    if (typeof window === "undefined") return 0.8
    const value = Number(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--eth-user-opacity")
        .trim() || 0
    )
    return value || 0.8
  }, [])

  const textStyles: CSSProperties = {
    letterSpacing: isAssistant
      ? "var(--eth-letter-spacing-assistant)"
      : "var(--eth-letter-spacing-user)",
    color: isAssistant
      ? isActive
        ? "rgba(255,255,255,1)"
        : "rgba(255,255,255,var(--eth-assistant-opacity))"
      : "rgba(255,255,255,var(--eth-assistant-opacity))",
    ...(isAssistant ? {} : { opacity: userOpacity }),
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
    >
      <div
        className={[
          "max-w-[84%] whitespace-pre-wrap leading-7",
          isAssistant
            ? "text-3xl sm:text-4xl leading-snug lowercase font-thin italic drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]"
            : "text-[15px] sm:text-[16px] font-thin lowercase drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]",
        ].join(" ")}
        style={textStyles}
      >
        {message.id === "ethereal-welcome" && (
          <p className="mb-2 text-sm text-white/60">dive back in.</p>
        )}
        {isAssistant && (
          <div className="mb-2 text-base" style={taskListStyles}>
            <TaskList tasks={tasks} />
          </div>
        )}
        <StreamingText text={message.content} />
      </div>
    </motion.div>
  )
}

