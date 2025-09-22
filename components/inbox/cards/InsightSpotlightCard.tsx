'use client'

import type { InboxEnvelope, InboxQuickActionValue } from '@/types/inbox'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export type InsightSpotlightEnvelope = Extract<InboxEnvelope, { type: 'insight_spotlight' }>

interface InsightSpotlightCardProps {
  envelope: InsightSpotlightEnvelope
  onOpen?: (envelope: InsightSpotlightEnvelope) => void
  onQuickAction?: (envelope: InsightSpotlightEnvelope, action: InboxQuickActionValue) => void
  className?: string
}

export function InsightSpotlightCard({ envelope, onOpen, onQuickAction, className }: InsightSpotlightCardProps) {
  const { payload } = envelope
  const readingTime = typeof payload.readingTimeMinutes === 'number' && payload.readingTimeMinutes > 0
    ? `${payload.readingTimeMinutes} min read`
    : undefined
  const actions = envelope.actions?.kind === 'boolean' ? envelope.actions : null
  const positiveLabel = actions?.positiveLabel ?? 'This resonates'
  const negativeLabel = actions?.negativeLabel ?? 'Not today'

  return (
    <div
      className={cn(
        'rounded-xl border border-border/40 bg-card/20 backdrop-blur p-4',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onOpen?.(envelope)}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`Open insight ${payload.title}`}
      >
        <div className="text-[10px] font-semibold tracking-[0.24em] text-foreground/60">
          INSIGHT SPOTLIGHT
        </div>
        <div className="mt-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-base font-semibold leading-tight text-foreground">{payload.title}</p>
            <p className="mt-2 text-sm text-foreground/80">{payload.summary}</p>
          </div>
          {readingTime ? (
            <span className="rounded-full border border-border/60 px-2 py-1 text-[10px] uppercase tracking-wide text-foreground/70">
              {readingTime}
            </span>
          ) : null}
        </div>
        {payload.cta?.helperText ? (
          <p className="mt-3 text-xs text-foreground/60">{payload.cta.helperText}</p>
        ) : (
          <p className="mt-3 text-xs text-foreground/60">Tap to open insight detail</p>
        )}
      </button>

      {actions ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="rounded-full px-4"
            onClick={() => onQuickAction?.(envelope, 'yes')}
          >
            {positiveLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="rounded-full px-4"
            onClick={() => onQuickAction?.(envelope, 'no')}
          >
            {negativeLabel}
          </Button>
          {actions.allowNotes ? (
            <span className="text-[11px] text-foreground/60">
              Add a note after choosing if you want to explain more.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
