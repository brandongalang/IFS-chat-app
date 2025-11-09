'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { InboxEnvelope } from '@/types/inbox'

export type CallToActionEnvelope = Extract<InboxEnvelope, { type: 'cta' }>

interface CallToActionCardProps {
  envelope: CallToActionEnvelope
  onOpen?: (envelope: CallToActionEnvelope) => void
  onVisit?: (envelope: CallToActionEnvelope) => void
  className?: string
}

export function CallToActionCard({ envelope, onOpen, onVisit, className }: CallToActionCardProps) {
  const { payload } = envelope
  const action = payload.action
  const intent = action.intent === 'secondary' ? 'secondary' : 'default'
  const href = action.href ?? '#'
  const target = action.target ?? '_self'

  return (
    <div className={cn('w-full rounded-xl border border-border/40 bg-card/20 backdrop-blur p-4', className)}>
      <button
        type="button"
        onClick={() => onOpen?.(envelope)}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`Open details for ${payload.title}`}
      >
        <div className="text-[10px] font-semibold tracking-[0.24em] text-foreground/60">CALL TO ACTION</div>
        <div className="mt-3">
          <p className="text-base font-semibold leading-tight text-foreground">{payload.title}</p>
          <p className="mt-2 text-sm text-foreground/80">{payload.description}</p>
        </div>
        {action.helperText ? (
          <p className="mt-3 text-xs text-foreground/60">{action.helperText}</p>
        ) : null}
      </button>

      <div className="mt-4">
        <Button
          asChild
          size="sm"
          variant={intent}
          className="rounded-full px-4"
          onClick={() => onVisit?.(envelope)}
        >
          <Link href={href} target={target}>
            {action.label}
          </Link>
        </Button>
      </div>
    </div>
  )
}
