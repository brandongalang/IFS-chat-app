"use client"

import { cn } from "@/lib/utils"

export interface LoaderProps {
  size?: number
  className?: string
  "aria-label"?: string
}

export function Loader({ size = 16, className, "aria-label": ariaLabel = "Loading" }: LoaderProps) {
  const dimension = `${size}px`
  return (
    <span
      aria-label={ariaLabel}
      role="status"
      className={cn("relative inline-flex items-center justify-center", className)}
    >
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current/40"
        style={{ width: dimension, height: dimension }}
      />
      <span
        className="inline-flex animate-spin rounded-full border-[1.5px] border-current/70 border-t-transparent"
        style={{ width: dimension, height: dimension }}
      />
    </span>
  )
}
