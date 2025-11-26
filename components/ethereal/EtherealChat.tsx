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
      {/* Background gradient for light mode */}
      <GradientBackdrop />

      {/* Dev Mode Indicator */}
      {devPersonaLabel && (
        <div className="absolute top-2 left-2 z-30">
          <div className="bg-orange-500/20 backdrop-blur-sm border border-orange-500/30 rounded-full px-3 py-1.5">
            <p className="text-xs text-orange-700 font-medium">
              Dev Mode: {devPersonaLabel}
            </p>
          </div>
        </div>
      )}


      {/* Messages area */}
      <div className="relative z-10 flex-1 overflow-y-auto overscroll-contain pb-[140px] pt-[calc(env(safe-area-inset-top)+40px)]">
        <div className="mx-auto w-full max-w-[52rem] px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
          <EtherealMessageList
            messages={messages}
            uiMessages={uiMessages}
            tasksByMessage={tasksByMessage}
            currentStreamingId={currentStreamingId}
          />
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar for light mode */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <PageContainer className="pointer-events-auto">
          <div className="rounded-[30px] border border-gray-200 bg-white p-3 shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
            <form onSubmit={onSubmit} className="space-y-3">
              {activeTool ? (
                <Tool className="border-orange-200 bg-orange-50 text-orange-900">
              <ToolHeader
                type={activeTool.type}
                state={activeTool.state}
                title={activeTool.title}
                subtitle={activeTool.subtitle}
                className="text-orange-900"
              />
                </Tool>
              ) : null}
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="type your thought…"
                className="min-h-[48px] max-h-[132px] w-full resize-none border-0 bg-transparent px-3 py-2.5 text-[16px] text-gray-900 placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:ring-0 focus:border-0 focus:shadow-[0_0_0_1px_rgba(249,115,22,0.3)] hover:shadow-[0_0_0_1px_rgba(249,115,22,0.15)] transition-shadow duration-200"
                data-testid="ethereal-input"
                aria-label="Message"
                disabled={isLoading || sessionClosed}
              />
              {sessionClosed && sessionState !== 'ended' ? (
                <div
                  className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-center text-[11px] uppercase tracking-[0.22em] text-orange-600"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  data-testid="end-session-status"
                >
                  ending session…
                </div>
              ) : null}
              <div className="flex items-center justify-end px-1 pb-1">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleEndSessionRequest}
                    disabled={sessionClosed || isLoading || !hasUserMessages}
                    className="min-h-11 h-11 px-4 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!hasUserMessages ? "Send a message to start your session" : "End session"}
                    aria-label={!hasUserMessages ? "End session disabled - send a message first" : "End session"}
                  >
                    <span className="text-xs uppercase tracking-[0.2em]">end session</span>
                  </Button>
                  <Button
                    size="sm"
                    type="submit"
                    disabled={!input.trim() || isLoading || sessionClosed}
                    className="min-h-11 h-11 min-w-11 px-6 rounded-full bg-orange-500 text-white hover:bg-orange-600 active:scale-95 transition-transform"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2 text-[13px] uppercase tracking-[0.2em]">
                        <span className="relative flex size-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/50" />
                          <span className="relative inline-flex size-2 rounded-full bg-white" />
                        </span>
                        sending
                      </span>
                    ) : (
                      <span className="text-[13px] uppercase tracking-[0.2em]">send</span>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </PageContainer>
      </div>
      
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

function GradientBackdrop() {
  // Light mode gradient with subtle orange accents
  const blobs = useMemo(
    () => [
      { x: -140, y: -80, size: 520, color: "#FFF7ED" },  // soft orange white
      { x: 140, y: 60, size: 460, color: "#FFEDD5" },   // warm peach
      { x: 20, y: 180, size: 620, color: "#FED7AA" },   // light orange
    ],
    []
  )

  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = () => setReduceMotion(mq.matches)
    handler()
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [])

  return (
    <div className="absolute inset-0 bg-white">
      {blobs.map((b, i) => (
        reduceMotion ? (
          <div
            key={i}
            className="absolute -z-20 blur-3xl"
            style={{
              opacity: 0.6,
              width: b.size,
              height: b.size,
              left: `calc(50% - ${b.size / 2}px)`,
              top: `calc(50% - ${b.size / 2}px)`,
              borderRadius: b.size,
              background: `radial-gradient(closest-side, ${b.color} 0%, rgba(255,255,255,0) 70%)`,
              filter: "blur(60px)",
            }}
          />
        ) : (
          <motion.div
            key={i}
            initial={{ x: b.x, y: b.y, opacity: 0.5 }}
            animate={{
              x: [b.x, b.x + (i % 2 === 0 ? 30 : -20), b.x],
              y: [b.y, b.y + (i % 2 === 0 ? -20 : 30), b.y],
              transition: { duration: 20 + i * 3, repeat: Infinity, ease: "easeInOut" },
            }}
            className="absolute -z-10 blur-3xl"
            style={{
              width: b.size,
              height: b.size,
              left: `calc(50% - ${b.size / 2}px)`,
              top: `calc(50% - ${b.size / 2}px)`,
              borderRadius: b.size,
              background: `radial-gradient(closest-side, ${b.color} 0%, rgba(255,255,255,0) 70%)`,
              filter: "blur(60px)",
            }}
          />
        )
      ))}
    </div>
  )
}
