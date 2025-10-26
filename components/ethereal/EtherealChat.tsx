"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { isToolOrDynamicToolUIPart } from "ai"
import { useChat } from "@/hooks/useChat"
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
    tasksByMessage,
    currentStreamingId,
    needsAuth,
    authLoading,
    sendMessage,
  } = useChat()
  const { push } = useRouter()
  // UI state
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [sessionState, setSessionState] = useState<'idle' | 'closing' | 'cleanup' | 'ended'>('idle')
  const sessionClosed = sessionState !== 'idle'
  const isClosing = sessionState === 'closing'

  // redirect to login if auth required
  useEffect(() => {
    if (!authLoading && needsAuth) {
      push('/auth/login')
    }
  }, [authLoading, needsAuth, push])

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

  // Separate effect to handle the 'ended' -> 'idle' transition
  useEffect(() => {
    if (sessionState !== 'ended') return

    const timer = setTimeout(() => {
      setSessionState('idle')
    }, 1500)

    return () => {
      clearTimeout(timer)
    }
  }, [sessionState])

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

  return (
    <div className="absolute inset-0 flex flex-col">
      <TrailheadBackdrop />
      <GradientBackdrop />

      {/* Messages area */}
      <div className="relative z-10 flex-1 overflow-y-auto overscroll-contain pb-[164px] pt-[calc(env(safe-area-inset-top)+40px)]">
        <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-6 px-4 sm:px-6 lg:px-8">
          <EtherealMessageList
            messages={messages}
            uiMessages={uiMessages}
            tasksByMessage={tasksByMessage}
            currentStreamingId={currentStreamingId}
          />
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <PageContainer className="pointer-events-auto">
          <div className="rounded-[30px] border border-border/60 bg-card/95 px-4 py-4 shadow-[0_28px_80px_rgba(188,163,127,0.22)] backdrop-blur-sm sm:px-6 sm:py-5">
            <form onSubmit={onSubmit} className="space-y-4">
              {activeTool ? (
                <Tool className="rounded-2xl border border-border/60 bg-background/80 text-foreground shadow-sm">
                  <ToolHeader
                    type={activeTool.type}
                    state={activeTool.state}
                    title={activeTool.title}
                    subtitle={activeTool.subtitle}
                    className="text-foreground"
                  />
                </Tool>
              ) : null}
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="type your thought…"
                className="!min-h-[52px] max-h-[140px] w-full resize-none rounded-2xl border border-border/60 bg-background/85 px-4 py-3 text-base text-foreground placeholder:text-muted-foreground shadow-[0_18px_60px_rgba(188,163,127,0.15)] transition-shadow duration-200 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background/80"
                data-testid="ethereal-input"
                aria-label="Message"
                disabled={isLoading || sessionClosed}
              />
              {sessionClosed && sessionState !== 'ended' ? (
                <div
                  className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-center text-[11px] uppercase tracking-[0.22em] text-muted-foreground"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  data-testid="end-session-status"
                >
                  ending session…
                </div>
              ) : null}
              <div className="flex items-center justify-end">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleEndSessionRequest}
                    disabled={sessionClosed || isLoading}
                    className="min-h-11 h-11 rounded-full border border-border/60 bg-card/70 px-4 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground transition focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background/80 hover:border-border hover:text-foreground active:scale-95"
                  >
                    <span className="text-xs uppercase tracking-[0.2em]">end session</span>
                  </Button>
                  <Button
                    size="sm"
                    type="submit"
                    disabled={!input.trim() || isLoading || sessionClosed}
                    className="min-h-11 h-11 min-w-12 rounded-full bg-primary px-6 text-xs font-semibold uppercase tracking-[0.24em] text-primary-foreground shadow-lg shadow-primary/20 transition focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background/80 hover:bg-primary/90 active:scale-95"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2 text-[13px] uppercase tracking-[0.2em]">
                        <span className="relative flex size-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                          <span className="relative inline-flex size-2 rounded-full bg-primary-foreground" />
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
    </div>
  )
}

const END_SESSION_PROMPT = "I want to end this session. Can you close out and take any notes from this conversation?"

function TrailheadBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#f4e6d4_0%,rgba(244,230,212,0)_60%)] dark:bg-[radial-gradient(circle_at_top,#3a2f29_0%,rgba(30,24,20,0)_65%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/60 to-background" />
    </div>
  )
}

function GradientBackdrop() {
  const blobs = useMemo(
    () => [
      { x: -180, y: -140, size: 560, color: "rgba(216,188,151,0.5)" },
      { x: 200, y: 80, size: 520, color: "rgba(191,160,120,0.45)" },
      { x: -40, y: 240, size: 660, color: "rgba(147,116,86,0.35)" },
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
    <div className="pointer-events-none absolute inset-0">
      {blobs.map((blob, index) => (
        reduceMotion ? (
          <div
            key={index}
            className="absolute -z-10 blur-3xl"
            style={{
              opacity: 0.8,
              width: blob.size,
              height: blob.size,
              left: `calc(50% - ${blob.size / 2}px)`,
              top: `calc(50% - ${blob.size / 2}px)`,
              borderRadius: blob.size,
              background: `radial-gradient(closest-side, ${blob.color} 0%, rgba(0,0,0,0) 70%)`,
              filter: 'blur(70px)',
            }}
          />
        ) : (
          <motion.div
            key={index}
            initial={{ x: blob.x, y: blob.y, opacity: 0.7 }}
            animate={{
              x: [blob.x, blob.x + (index % 2 === 0 ? 26 : -24), blob.x],
              y: [blob.y, blob.y + (index % 2 === 0 ? -18 : 28), blob.y],
              transition: { duration: 26 + index * 4, repeat: Infinity, ease: 'easeInOut' },
            }}
            className="absolute -z-10 blur-3xl"
            style={{
              width: blob.size,
              height: blob.size,
              left: `calc(50% - ${blob.size / 2}px)`,
              top: `calc(50% - ${blob.size / 2}px)`,
              borderRadius: blob.size,
              background: `radial-gradient(closest-side, ${blob.color} 0%, rgba(0,0,0,0) 70%)`,
              filter: 'blur(70px)',
              mixBlendMode: 'screen',
            }}
          />
        )
      ))}
    </div>
  )
}
