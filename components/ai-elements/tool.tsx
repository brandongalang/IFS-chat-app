"use client"

import { cn } from "@/lib/utils"
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react"
import type { ComponentProps } from "react"

export type ToolState = "input-streaming" | "input-available" | "output-available" | "output-error" | string

export type ToolProps = ComponentProps<"div">

export function Tool({ className, ...props }: ToolProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/40 bg-background/70 px-3 py-2 text-sm text-muted-foreground shadow-sm backdrop-blur",
        className,
      )}
      {...props}
    />
  )
}

export interface ToolHeaderProps extends ComponentProps<"div"> {
  type: string
  state: ToolState
  label?: string
}

const STATE_COPY: Record<Extract<ToolState, string>, string> = {
  "input-streaming": "Preparing…",
  "input-available": "Running…",
  "output-available": "Done",
  "output-error": "Failed",
}

function iconForState(state: ToolState) {
  switch (state) {
    case "input-streaming":
    case "input-available":
      return <Loader2 className="size-3.5 animate-spin" />
    case "output-available":
      return <CircleCheck className="size-3.5" />
    case "output-error":
      return <CircleAlert className="size-3.5" />
    default:
      return <Loader2 className="size-3.5 animate-spin" />
  }
}

function statusForState(state: ToolState) {
  return STATE_COPY[state] ?? "Working…"
}

export function ToolHeader({ type, state, label, className, ...props }: ToolHeaderProps) {
  const text = label ?? friendlyLabel(type)

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground",
        className,
      )}
      {...props}
    >
      <span className="inline-flex items-center justify-center text-foreground/80">
        {iconForState(state)}
      </span>
      <span className="text-foreground/95">{text}</span>
      <span className="text-foreground/70">{statusForState(state)}</span>
    </div>
  )
}

const FRIENDLY_LABELS: Array<{ match: RegExp; label: string }> = [
  { match: /search|retrieve|query/i, label: "Searching…" },
  { match: /rag|context|memory/i, label: "Gathering context…" },
  { match: /write|generate|respond/i, label: "Composing…" },
  { match: /note/i, label: "Reviewing notes…" },
]

function friendlyLabel(type: string) {
  const cleaned = type.replace(/^tool[-:]/i, "").replace(/[-_]/g, " ").trim()
  for (const entry of FRIENDLY_LABELS) {
    if (entry.match.test(type)) return entry.label
  }
  if (cleaned.length === 0) return "Tool"
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}
