"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { motion } from "framer-motion"
import { useChat } from "@/hooks/useChat"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import type { Message as ChatMessage } from "@/types/chat"
import { useRouter } from "next/navigation"
import { StreamingText } from "./StreamingText"
import { TaskList } from "@/components/tasks/TaskList"
import { ActiveTaskOverlay } from "./ActiveTaskOverlay"
import { PageContainer } from "@/components/common/PageContainer"

// Minimal, bubble-less chat presentation
export function EtherealChat() {
  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    hasActiveSession,
    endSession,
    addAssistantMessage,
    tasksByMessage,
    currentStreamingId,
    needsAuth,
    authLoading,
  } = useChat()
  const router = useRouter()
  const taskListStyles: CSSProperties = {
    '--muted-foreground': '0 0% 80%',
    '--foreground': '0 0% 100%',
    '--secondary': '0 0% 100% / 0.1',
    '--secondary-foreground': '0 0% 100%',
    '--border': '0 0% 100% / 0.2',
  } as CSSProperties

  // UI state
  const [confirmOpen, setConfirmOpen] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // redirect to login if auth required
  useEffect(() => {
    if (!authLoading && needsAuth) router.push('/auth/login')
  }, [authLoading, needsAuth, router])

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

      {/* Top bar with translucent End button (only when a session exists) */}
      <div className="pointer-events-none absolute top-[calc(env(safe-area-inset-top)+8px)] right-3 z-20">
        <div className="flex items-center gap-2">
          {hasActiveSession && (
            <button
              onClick={() => setConfirmOpen(true)}
              className="pointer-events-auto rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/90 backdrop-blur-sm hover:bg-white/15 active:scale-[0.98] transition"
              aria-label="End session"
            >
              end
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="relative z-10 flex-1 overflow-y-auto pb-[120px] pt-[calc(env(safe-area-inset-top)+16px)]">
        <PageContainer className="flex flex-col gap-6">
          {(messages as ChatMessage[]).map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={[
                  "max-w-[84%] whitespace-pre-wrap leading-7",
                  m.role === "assistant"
                    ? "text-3xl sm:text-4xl leading-snug lowercase font-thin italic drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]"
                    : "text-[15px] sm:text-[16px] font-thin lowercase drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]",
                ].join(" ")}
                style={{
                  letterSpacing: m.role === 'assistant' ? 'var(--eth-letter-spacing-assistant)' : 'var(--eth-letter-spacing-user)',
                  color: m.role === 'assistant'
                    ? (m.id === currentStreamingId
                      ? 'rgba(255,255,255,1)'
                      : 'rgba(255,255,255,var(--eth-assistant-opacity))')
                    : 'rgba(255,255,255,var(--eth-assistant-opacity))',
                  opacity: m.role === 'assistant' ? undefined : (Number(getComputedStyle(document.documentElement).getPropertyValue('--eth-user-opacity').trim()) || 0.8),
                }}
              >
                {m.id === "ethereal-welcome" && (
                  <p className="mb-2 text-sm text-white/60">dive back in.</p>
                )}
                {m.role === 'assistant' && (
                  <div className="mb-2 text-base" style={taskListStyles}>
                    <TaskList tasks={tasksByMessage?.[m.id]} data-testid="task-list" />
                  </div>
                )}
                <StreamingText text={m.content} />
              </div>
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
        </PageContainer>
      </div>

      {/* Task overlay for current streaming message */}
      {currentTasks?.length ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(100px+env(safe-area-inset-bottom))] z-20">
          <PageContainer className="pointer-events-auto">
            <ActiveTaskOverlay tasks={currentTasks} />
          </PageContainer>
        </div>
      ) : null}

      {/* Translucent input bar (always visible) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <PageContainer className="pointer-events-auto">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-2 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.25)]">
            <form onSubmit={handleSubmit} className="space-y-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="type your thought…"
                className="min-h-[44px] max-h-[132px] w-full resize-none border-0 bg-transparent p-3 text-[16px] text-white/90 placeholder:text-white/50 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:ring-0 focus:border-0 focus:shadow-[0_0_0_1px_rgba(255,255,255,0.15)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.1)] transition-shadow duration-200"
                data-testid="ethereal-input"
                aria-label="Message"
                disabled={isLoading}
              />
              <div className="flex items-center justify-end px-2 pb-1">
                <Button
                  size="sm"
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="h-8 rounded-full bg-white/20 px-4 text-white hover:bg-white/30"
                >
                  send
                </Button>
              </div>
            </form>
          </div>
        </PageContainer>
      </div>

      {/* Confirm end session dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End current session?</AlertDialogTitle>
            <AlertDialogDescription>
              Ending will clear the current conversation flow. You can start a new one anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await endSession()
                setConfirmOpen(false)
                router.push('/')
              }}
            >
              End session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

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
