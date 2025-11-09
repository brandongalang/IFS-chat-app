"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { isToolOrDynamicToolUIPart } from "ai"
import { useChat } from "@/hooks/useChat"
import { dev } from "@/config/dev"
import { getCurrentPersona as getClientPersona, TEST_PERSONAS } from "@/config/personas"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { PageContainer } from "@/components/common/PageContainer"
import { EtherealMessageList } from "./EtherealMessageList"
import { Tool, ToolHeader, friendlyToolLabel } from "@/components/ai-elements/tool"
import { MaterialIcon } from "@/components/ui/MaterialIcon"
import type { ToolHeaderProps } from "@/components/ai-elements/tool"
import { useRouter } from "next/navigation"
import type { ToolUIPart } from "@/app/_shared/hooks/useChat.helpers"
import { readAndClearContextFromSession } from "@/lib/inbox/chat-bridge"
import { emitInboxEvent } from "@/lib/analytics/inbox"
import { EndSessionDialog } from "./EndSessionDialog"

type ActiveToolState = ToolHeaderProps["state"]
type ActiveToolType = ToolHeaderProps["type"]

interface ActiveTool {
  id: string
  type: ActiveToolType
  state: ActiveToolState
  title?: string
  subtitle?: string
}

const ACTIVE_TOOL_STATES: readonly ActiveToolState[] = ["input-streaming", "input-available"] as const

function normalizeToolState(state?: string): ActiveToolState {
  if (!state) return "input-available"
  const lower = state.toLowerCase()
  if (lower === "output-error" || lower.startsWith("error")) return "output-error"
  if (lower === "output-available") return "output-available"
  if (lower.startsWith("output")) return "input-streaming"
  if (lower === "input-available") return "input-available"
  if (lower === "input-streaming" || lower.startsWith("input")) return "input-streaming"
  return "input-available"
}

function slugifyToolSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function normalizeToolType(part: ToolUIPart, index: number): ActiveToolType {
  const rawType = typeof part.type === "string" ? part.type : undefined
  if (rawType && rawType.startsWith("tool-")) {
    return rawType as ActiveToolType
  }

  const rawName = typeof part.toolName === "string" && part.toolName.trim().length > 0
    ? part.toolName
    : rawType
  if (rawName) {
    const segment = slugifyToolSegment(rawName)
    return (`tool-${segment || index}`) as ActiveToolType
  }

  return (`tool-${index}`) as ActiveToolType
}

// Minimal, bubble-less chat presentation
export function EtherealChat() {
  const {
    messages,
    uiMessages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    hasActiveSession,
    endSession,
    clearChat,
    tasksByMessage,
    currentStreamingId,
    needsAuth,
    authLoading,
    sendMessage,
  } = useChat()
  const { push } = useRouter()
  const devModeEnabled = dev.enabled
  // UI state
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [sessionState, setSessionState] = useState<'idle' | 'closing' | 'cleanup' | 'ended'>('idle')
  const sessionClosed = sessionState !== 'idle'
  const isClosing = sessionState === 'closing'
  const [showEndSessionDialog, setShowEndSessionDialog] = useState(false)

  // Track whether user has sent at least one message
  const hasUserMessages = useMemo(() => {
    return messages.some(msg => msg.role === 'user')
  }, [messages])

  // redirect to login if auth required (but not in dev mode)
  useEffect(() => {
    // In dev mode, needsAuth should always be false due to mock profile
    if (!authLoading && needsAuth && !devModeEnabled) {
      push('/auth/login')
    }
  }, [authLoading, needsAuth, push, devModeEnabled])

  // End any active session when this component unmounts
  useEffect(() => {
    return () => {
      if (hasActiveSession) void endSession()
    }
  }, [hasActiveSession, endSession])

  // Auto-resize textarea
  useEffect(() => {
    if (!inputRef.current) return
    inputRef.current.style.height = "auto"
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 132)}px`
  }, [input])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    if (!isLoading) {
      inputRef.current?.focus()
    }
  }, [messages, isLoading])

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (sessionClosed) {
      e.preventDefault()
      return
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Seed agent response when coming from inbox context
  const seededRef = useRef(false)
  const inboxContextRef = useRef<string | null>(null)
  useEffect(() => {
    if (authLoading || needsAuth) return
    if (seededRef.current) return
    if ((messages?.length ?? 0) === 0) {
      // Check for inbox-to-chat context
      try {
        const ctx = readAndClearContextFromSession()
        if (ctx) {
          seededRef.current = true
          inboxContextRef.current = ctx.systemInstruction
          // Send empty message to trigger agent response with context
          void sendMessage('', ctx.systemInstruction)
          // analytics: chat started from inbox
          const obs = ctx.metadata.observation
          emitInboxEvent('chat_started_from_inbox', {
            envelopeId: (obs as { id?: string })?.id ?? 'unknown',
            sourceId: obs.sourceId ?? (obs as { id?: string })?.id ?? 'unknown',
            messageType: obs.type ?? 'insight_spotlight',
            source: obs.source ?? 'network',
            metadata: { reaction: ctx.metadata.reaction },
          })
        }
      } catch {
        // ignore seed if context invalid
      }
    }
  }, [messages?.length, sendMessage, needsAuth, authLoading])

  const activeTool = useMemo<ActiveTool | undefined>(() => {
    for (let i = uiMessages.length - 1; i >= 0; i -= 1) {
      const message = uiMessages[i]
      if (!Array.isArray(message.parts)) continue
      for (let j = message.parts.length - 1; j >= 0; j -= 1) {
        const part = message.parts[j]
        if (!isToolOrDynamicToolUIPart(part)) continue

        const toolPart = part as ToolUIPart
        const normalizedState = normalizeToolState(typeof toolPart.state === "string" ? toolPart.state : undefined)
        if (!ACTIVE_TOOL_STATES.includes(normalizedState)) {
          continue
        }

        const type = normalizeToolType(toolPart, j)
        const explicitTitle = typeof toolPart.toolName === "string" ? toolPart.toolName.trim() : ""
        const metaTitle = typeof toolPart.meta?.displayTitle === "string" ? toolPart.meta.displayTitle.trim() : ""
        const fallbackTitle = friendlyToolLabel(type)
        const titleCandidate = metaTitle || explicitTitle || (/^\d+$/.test(fallbackTitle) ? "Tool" : fallbackTitle)
        const subtitle = typeof toolPart.meta?.displayNote === "string" ? toolPart.meta.displayNote.trim() : undefined

        return {
          id: toolPart.toolCallId ?? `${message.id}-${j}`,
          type,
          state: normalizedState,
          title: titleCandidate,
          subtitle,
        }
      }
    }

    return undefined
  }, [uiMessages])

  const handleEndSessionRequest = useCallback(async () => {
    if (sessionState !== 'idle') return
    setSessionState('closing')
    setInput('')
    try {
      const dispatched = await sendMessage(END_SESSION_PROMPT)
      setSessionState(dispatched ? 'cleanup' : 'idle')
    } catch (error) {
      console.error('Failed to send end-session prompt', error)
      setSessionState('idle')
    }
  }, [sessionState, sendMessage, setInput])

  useEffect(() => {
    if (sessionState !== 'cleanup') return
    if (isLoading || currentStreamingId) return

    let cancelled = false

    const finalize = async () => {
      try {
        seededRef.current = false
        await endSession()
        if (!cancelled) {
          setSessionState('ended')
        }
      } catch (error) {
        console.error('Failed to finalize session cleanup', error)
        if (!cancelled) {
          setSessionState('idle')
        }
      }
    }

    void finalize()

    return () => {
      cancelled = true
    }
  }, [sessionState, isLoading, currentStreamingId, endSession])

  // Show modal when session ends
  useEffect(() => {
    if (sessionState === 'ended') {
      setShowEndSessionDialog(true)
      setSessionState('idle')
    }
  }, [sessionState])

  const handleStartNewSession = useCallback(() => {
    setShowEndSessionDialog(false)
    clearChat()
    setSessionState('idle')
  }, [clearChat])

  const onSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    if (sessionClosed || isClosing) {
      event.preventDefault()
      return
    }
    handleSubmit(event)
  }

  if (!authLoading && needsAuth) {
    return null
  }

  let devPersonaLabel: string | null = null
  if (devModeEnabled) {
    const persona = getClientPersona()
    const personaConfig = TEST_PERSONAS[persona]
    devPersonaLabel = personaConfig?.name || `${persona} (Missing)`
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Dev Mode Indicator */}
      {devPersonaLabel && (
        <div className="absolute top-2 left-2 z-30">
          <div className="bg-green-500/20 backdrop-blur-sm border border-green-500/30 rounded-full px-3 py-1.5">
            <p className="text-xs text-green-300 font-medium">
              Dev Mode: {devPersonaLabel}
            </p>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="relative z-10 flex-1 overflow-y-auto overscroll-contain">
        <EtherealMessageList
          messages={messages}
          uiMessages={uiMessages}
          tasksByMessage={tasksByMessage}
          currentStreamingId={currentStreamingId}
        />
        <div ref={messagesEndRef} />
      </div>

      {/* Composer Footer */}
      <footer className="bg-background-light dark:bg-background-dark sticky bottom-0 z-10 pt-2 pb-4">
        {/* Active Tool Chip */}
        {activeTool && (
          <div className="flex gap-3 px-4 pb-3 overflow-x-auto">
            <div className="flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full bg-chip-light dark:bg-chip-dark pl-4 pr-4">
              <p className="text-text-primary-light dark:text-text-primary-dark text-sm font-medium leading-normal">
                Active Tool: {activeTool.title || friendlyToolLabel(activeTool.type)}
              </p>
            </div>
          </div>
        )}

        {/* Text Input */}
        <div className="flex items-center px-4 py-1 gap-3">
          <form onSubmit={onSubmit} className="flex flex-1 items-center gap-3">
            <label className="flex flex-col min-w-40 h-12 flex-1">
              <div className="flex w-full flex-1 items-stretch rounded-full h-full bg-composer-light dark:bg-composer-dark shadow-soft">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="What are you noticing now?"
                  className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-full text-text-primary-light dark:text-text-primary-dark focus:outline-0 focus:ring-0 border-none bg-transparent h-full placeholder:text-placeholder-light dark:placeholder:text-placeholder-dark px-5 text-base font-normal leading-normal"
                  data-testid="ethereal-input"
                  aria-label="Message"
                  disabled={isLoading || sessionClosed}
                />
                <div className="flex border-none items-center justify-center pr-2">
                  <Button
                    type="submit"
                    disabled={isLoading || sessionClosed || !input.trim()}
                    className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Send message"
                  >
                    <MaterialIcon name="arrow_upward" size={20} />
                  </Button>
                </div>
              </div>
            </label>
          </form>
        </div>
      </footer>
      
      {/* End Session Modal */}
      <EndSessionDialog
        open={showEndSessionDialog}
        onOpenChange={setShowEndSessionDialog}
        onStartNewSession={handleStartNewSession}
      />
    </div>
  )
}

const END_SESSION_PROMPT = "I want to end this session. Can you close out and take any notes from this conversation?"
