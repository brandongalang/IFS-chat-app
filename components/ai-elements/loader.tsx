'use client'

import { cn } from '@/lib/utils'

export const Loader = ({ className }: { className?: string }) => (
  <div className={cn('text-xs text-muted-foreground p-2', className)}>Thinking…</div>
)


