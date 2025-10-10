"use client";

import { cn } from "@/lib/utils";
import type { ToolUIPart } from "ai";
import { CheckCircleIcon, Loader2, XCircleIcon } from "lucide-react";
import type { ComponentProps } from "react";

// Simplified Tool to be a simple div wrapper
export type ToolProps = ComponentProps<"div">;

export const Tool = ({ className, ...props }: ToolProps) => (
  <div
    className={cn("not-prose w-full rounded-md border", className)}
    {...props}
  />
);

// Header props remain the same for type safety
export type ToolHeaderProps = {
  title?: string;
  type: ToolUIPart["type"] | string;
  state: ToolUIPart["state"] | string;
  className?: string;
};

// Simplified icon logic based on user request
export function iconForToolState(state: ToolUIPart["state"] | string) {
  if (typeof state === "string" && (state === "output-error" || state.startsWith("error"))) {
    return <XCircleIcon className="size-4 text-red-500" />;
  }

  switch (state) {
    case "input-streaming":
    case "input-available":
      return <Loader2 className="size-4 animate-spin" />;
    case "output-available":
      return <CheckCircleIcon className="size-4 text-green-500" />;
    default:
      // A sensible default for unknown states
      return <Loader2 className="size-4 animate-spin" />;
  }
}

// User-requested friendly labels
const FRIENDLY_LABELS: Array<{ match: RegExp; label: string }> = [
  { match: /read/i, label: "Looking through notes…" },
  { match: /write/i, label: "Writing notes…" },
  { match: /search|retrieve|query/i, label: "Searching…" },
  { match: /rag|context|memory/i, label: "Gathering context…" },
  { match: /generate|respond/i, label: "Composing…" },
  { match: /note/i, label: "Reviewing notes…" }, // Fallback for 'note' if not read/write
];

export function friendlyToolLabel(type: string): string {
  for (const entry of FRIENDLY_LABELS) {
    if (entry.match.test(type)) return entry.label;
  }
  const cleaned = type.replace(/^tool[-:]/i, "").replace(/[-_]/g, " ").trim();
  if (cleaned.length === 0) return "Tool";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// Simplified ToolHeader, no longer a collapsible trigger
export const ToolHeader = ({
  className,
  title,
  type,
  state,
  ...props
}: ToolHeaderProps) => (
  <div
    className={cn("flex w-full items-center gap-2 p-3 text-sm", className)}
    {...props}
  >
    {iconForToolState(state)}
    <span className="font-medium">{title ?? friendlyToolLabel(type)}</span>
  </div>
);