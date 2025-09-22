'use client'

import type { InboxFeedVariant } from '@/types/inbox'
import { InboxShelf } from '@/components/inbox/InboxShelf'

interface InboxProps {
  variant?: InboxFeedVariant
  className?: string
}

export function Inbox({ variant = 'pragmatic', className }: InboxProps) {
  return <InboxShelf variant={variant} className={className} />
}
