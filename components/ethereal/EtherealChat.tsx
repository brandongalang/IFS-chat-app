"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <PageContainer className="flex h-full flex-col gap-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)] md:pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <section className="flex-1 overflow-hidden rounded-xl border border-border/40 bg-card/30 shadow-sm backdrop-blur-sm">
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6">
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
                <EtherealMessageList
                  messages={messages}
                  uiMessages={uiMessages}
                  tasksByMessage={tasksByMessage}
                  currentStreamingId={currentStreamingId}
                />
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border/40 bg-card/50 shadow-sm backdrop-blur-sm">
          <form onSubmit={onSubmit} className="flex flex-col gap-4 p-4 sm:p-5">
            {activeTool ? (
              <Tool className="rounded-lg border-border/50 bg-secondary/10 text-foreground">
                <ToolHeader
                  type={activeTool.type}
                  state={activeTool.state}
                  title={activeTool.title}
                  subtitle={activeTool.subtitle}
                />
              </Tool>
            ) : null}
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Share what's on your mind…"
              className="min-h-[56px] max-h-36 resize-none bg-background/80 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
              data-testid="ethereal-input"
              aria-label="Message"
              disabled={isLoading || sessionClosed}
            />
            {sessionClosed && sessionState !== 'ended' ? (
              <div
                className="w-full rounded-full border border-border/40 bg-muted/30 px-3 py-1 text-center text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground"
                role="status"
                aria-live="polite"
                aria-atomic="true"
                data-testid="end-session-status"
              >
                ending session…
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleEndSessionRequest}
                disabled={sessionClosed || isLoading}
              >
                End session
              </Button>
              <Button
                type="submit"
                disabled={!input.trim() || isLoading || sessionClosed}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2 text-sm">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40" />
                      <span className="relative inline-flex size-2 rounded-full bg-primary" />
                    </span>
                    Sending…
                  </span>
                ) : (
                  "Send"
                )}
              </Button>
            </div>
          </form>
        </section>
      </PageContainer>
    </div>
  )
}

const END_SESSION_PROMPT = "I want to end this session. Can you close out and take any notes from this conversation?"
