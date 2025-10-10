"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { isToolOrDynamicToolUIPart } from "ai"
import { useChat } from "@/hooks/useChat"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { ActiveTaskOverlay } from "./ActiveTaskOverlay"
import { PageContainer } from "@/components/common/PageContainer"
import { EtherealMessageList } from "./EtherealMessageList"
import { Tool, ToolHeader } from "@/components/ai-elements/tool"
import type { ToolHeaderProps } from "@/components/ai-elements/tool"
import { useRouter } from "next/navigation"
import type { ToolUIPart } from "@/app/_shared/hooks/useChat.helpers"

type ActiveToolState = ToolHeaderProps["state"]
type ActiveToolType = ToolHeaderProps["type"]

interface ActiveTool {
  id: string
  type: ActiveToolType
  state: ActiveToolState
  title?: string
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
    sessionEnded,
    endSession,
    addAssistantMessage,
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

  useEffect(() => {
    if (sessionEnded) {
      setSessionState((prev) => (prev === 'ended' ? prev : 'ended'))
    } else if (sessionState === 'ended') {
      setSessionState('idle')
    }
  }, [sessionEnded, sessionState])

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
    if (sessionClosed || isClosing) {
      e.preventDefault()
      return
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Ensure the hero message is present and persisted on a fresh session
  const seededRef = useRef(false)
  useEffect(() => {
    if (authLoading || needsAuth) return
    if (seededRef.current) return
    if ((messages?.length ?? 0) === 0) {
      seededRef.current = true
      addAssistantMessage("what feels unresolved or undefined for you right now?", { persist: true, id: "ethereal-welcome" })
    }
  }, [messages?.length, addAssistantMessage, needsAuth, authLoading])

  const currentTasks = currentStreamingId ? tasksByMessage?.[currentStreamingId] : undefined

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
        const title = typeof toolPart.toolName === "string" && toolPart.toolName.trim().length > 0
          ? toolPart.toolName.trim()
          : typeof toolPart.type === "string" && toolPart.type.length > 0
          ? toolPart.type
          : "tool"

        return {
          id: toolPart.toolCallId ?? `${message.id}-${j}`,
          type,
          state: normalizedState,
          title,
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
      {/* Background image (optional) with gradient fallback */}
      <BackgroundImageLayer />
      <GradientBackdrop />
      {/* Subtle vignette to improve contrast over bright areas */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.10)_0%,rgba(0,0,0,0.22)_55%,rgba(0,0,0,0.38)_100%)]" />


      {/* Messages area */}
      <div className="relative z-10 flex-1 overflow-y-auto pb-[120px] pt-[calc(env(safe-area-inset-top)+16px)]">
        <PageContainer className="flex flex-col gap-6">
          {currentTasks?.length ? (
            <div className="sticky top-[calc(env(safe-area-inset-top)+12px)] z-20 mb-4">
              <ActiveTaskOverlay tasks={currentTasks} />
            </div>
          ) : null}
          <EtherealMessageList
            messages={messages}
            uiMessages={uiMessages}
            tasksByMessage={tasksByMessage}
            currentStreamingId={currentStreamingId}
          />
          <div ref={messagesEndRef} />
        </PageContainer>
      </div>

      {/* Translucent input bar (always visible) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <PageContainer className="pointer-events-auto">
          <div className="rounded-[30px] border border-white/15 bg-white/10 p-3 backdrop-blur-2xl shadow-[0_12px_42px_rgba(0,0,0,0.28)]">
            <form onSubmit={onSubmit} className="space-y-3">
              {activeTool ? (
                <Tool className="border-white/15 bg-white/10 text-white">
                  <ToolHeader
                    type={activeTool.type}
                    state={activeTool.state}
                    title={activeTool.title}
                    className="text-white"
                  />
                </Tool>
              ) : null}
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="type your thought…"
                className="min-h-[48px] max-h-[132px] w-full resize-none border-0 bg-transparent px-3 py-2.5 text-[16px] text-white/90 placeholder:text-white/50 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:ring-0 focus:border-0 focus:shadow-[0_0_0_1px_rgba(255,255,255,0.18)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.12)] transition-shadow duration-200"
                data-testid="ethereal-input"
                aria-label="Message"
                disabled={isLoading || sessionClosed || isClosing}
              />
              {sessionClosed ? (
                <div className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-center text-[11px] uppercase tracking-[0.22em] text-white/60">
                  {sessionState === 'ended' || sessionEnded ? 'session ended' : 'ending session…'}
                </div>
              ) : null}
              <div className="flex items-center justify-end px-2 pb-1">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleEndSessionRequest}
                    disabled={sessionClosed || isLoading || isClosing}
                    className="h-9 rounded-full bg-white/5 text-white hover:bg-white/10"
                  >
                    <span className="text-[11px] uppercase tracking-[0.2em]">end session</span>
                  </Button>
                  <Button
                    size="sm"
                    type="submit"
                    disabled={!input.trim() || isLoading || sessionClosed || isClosing}
                    className="h-9 rounded-full bg-white/18 px-5 text-white hover:bg-white/28"
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
    </div>
  )
}

const END_SESSION_PROMPT = "I want to end this session. Can you close out and take any notes from this conversation?"

function GradientBackdrop() {
  // animated blurred blobs using framer-motion; colors tuned to teal-gray ambiance
  const blobs = useMemo(
    () => [
      { x: -140, y: -80, size: 520, color: "#1f3a3f" }, // deep teal
      { x: 140, y: 60, size: 460, color: "#2a4d52" },  // mid teal
      { x: 20, y: 180, size: 620, color: "#d39a78" },  // warm peach accent
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
    <div className="absolute inset-0">
      {blobs.map((b, i) => (
        reduceMotion ? (
          <div
            key={i}
          className="absolute -z-20 blur-3xl"
            style={{
              opacity: 0.5,
              width: b.size,
              height: b.size,
              left: `calc(50% - ${b.size / 2}px)`,
              top: `calc(50% - ${b.size / 2}px)`,
              borderRadius: b.size,
              background: `radial-gradient(closest-side, ${b.color} 0%, rgba(0,0,0,0) 70%)`,
              filter: "blur(60px)",
            }}
          />
        ) : (
          <motion.div
            key={i}
          initial={{ x: b.x, y: b.y, opacity: 0.4 }}
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
              background: `radial-gradient(closest-side, ${b.color} 0%, rgba(0,0,0,0) 70%)`,
              filter: "blur(60px)",
            }}
          />
        )
      ))}
    </div>
  )
}

function BackgroundImageLayer() {
  // Attempts to show /ethereal-bg.jpg; remains silent if not found
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/ethereal-bg.jpg"
        alt="background"
        className="absolute inset-0 h-full w-full object-cover z-0 blur-xl scale-105 opacity-90"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        loading="eager"
        draggable={false}
      />
    </>
  )
}
