'use client'

import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

export type ReasoningProps = HTMLAttributes<HTMLDivElement> & {
  isStreaming?: boolean
}

export const Reasoning = ({ className, isStreaming, children, ...props }: ReasoningProps) => (
  <div
    className={cn(
      'rounded-md border bg-muted text-muted-foreground p-3 text-xs',
      isStreaming && 'animate-pulse',
      className
    )}
    {...props}
  >
    {children}
  </div>
)

export const ReasoningTrigger = ({ className, ...props }: HTMLAttributes<HTMLButtonElement>) => (
  <button className={cn('underline text-xs opacity-70 hover:opacity-100', className)} {...props}>
    Show reasoning
  </button>
)

export const ReasoningContent = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mt-2 whitespace-pre-wrap', className)} {...props} />
)


