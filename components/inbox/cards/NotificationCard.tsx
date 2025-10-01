'use client'

import type { InboxEnvelope, InboxQuickActionValue } from '@/types/inbox'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export type NotificationEnvelope = Extract<InboxEnvelope, { type: 'notification' }>

interface NotificationCardProps {
  envelope: NotificationEnvelope
  onOpen?: (envelope: NotificationEnvelope) => void
  onQuickAction?: (envelope: NotificationEnvelope, action: InboxQuickActionValue) => void
  className?: string
}

export function NotificationCard({ envelope, onOpen, onQuickAction, className }: NotificationCardProps) {
  const { payload } = envelope
  const actions = envelope.actions?.kind === 'acknowledge' ? envelope.actions : null
  const label = actions?.label ?? 'Got it'

  return (
    <div className={cn('rounded-xl border border-border/40 bg-card/15 backdrop-blur p-4', className)}>
      <div className="text-[10px] font-semibold tracking-[0.24em] text-foreground/60">NOTIFICATION</div>
      <div className="mt-3">
        <p className="text-base font-semibold leading-tight text-foreground">{payload.title}</p>
        <p className="mt-2 text-sm text-foreground/80">{payload.body}</p>
      </div>
      {payload.link ? (
        <Link
          href={payload.link.href}
          target={payload.link.target ?? '_self'}
          onClick={() => onOpen?.(envelope)}
          className="mt-3 inline-flex items-center text-xs text-foreground underline"
        >
          {payload.link.label}
        </Link>
      ) : null}
      {actions ? (
        <div className="mt-4 flex flex-col gap-2">
          <Button
            type="button"
            size="sm"
            className="rounded-full px-4"
            onClick={() => onQuickAction?.(envelope, 'ack')}
          >
            {label}
          </Button>
          {actions.helperText ? (
            <span className="text-[11px] text-foreground/60">{actions.helperText}</span>
          ) : null}
          {actions.allowNotes ? (
            <span className="text-[11px] text-foreground/50">
              You can add an optional note after acknowledging.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
