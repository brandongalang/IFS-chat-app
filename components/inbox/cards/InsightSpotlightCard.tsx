'use client'

import type { InboxEnvelope, InboxQuickActionValue } from '@/types/inbox'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export type InsightSpotlightEnvelope = Extract<InboxEnvelope, { type: 'insight_spotlight' }>

interface InsightSpotlightCardProps {
  envelope: InsightSpotlightEnvelope
  onOpen?: (envelope: InsightSpotlightEnvelope) => void
  onQuickAction?: (envelope: InsightSpotlightEnvelope, action: InboxQuickActionValue) => void
  onExploreInChat?: (envelope: InsightSpotlightEnvelope, reaction: 'confirmed' | 'denied') => void
  className?: string
}

export function InsightSpotlightCard({ envelope, onOpen, onQuickAction, onExploreInChat, className }: InsightSpotlightCardProps) {
  const { payload } = envelope
  const readingTime = typeof payload.readingTimeMinutes === 'number' && payload.readingTimeMinutes > 0
    ? `${payload.readingTimeMinutes} min read`
    : undefined
  const actions = envelope.actions?.kind === 'scale4' ? envelope.actions : null
  const scaleOptions: { value: InboxQuickActionValue; label: string }[] = actions
    ? [
        { value: 'agree_strong', label: actions.agreeStrongLabel ?? 'Agree a lot' },
        { value: 'agree', label: actions.agreeLabel ?? 'Agree a little' },
        { value: 'disagree', label: actions.disagreeLabel ?? 'Disagree a little' },
        { value: 'disagree_strong', label: actions.disagreeStrongLabel ?? 'Disagree a lot' },
      ]
    : []

  const lastAction = (envelope.metadata as Record<string, unknown> | undefined)?.lastAction as
    | InboxQuickActionValue
    | undefined
  const reaction: 'confirmed' | 'denied' | undefined = lastAction
    ? lastAction.startsWith('agree')
      ? 'confirmed'
      : 'denied'
    : undefined

  const actioned = Boolean(reaction)

  return (
    <div
      className={cn(
        'rounded-xl border border-border/40 bg-card/20 backdrop-blur p-4',
        actioned && 'opacity-80',
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

      {actioned ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border/60 px-2 py-1 text-[10px] uppercase tracking-wide text-foreground/70">
            ✓ {reaction === 'confirmed' ? 'Agreed' : 'Disagreed'}
          </span>
          <Button
            type="button"
            size="sm"
            className="rounded-full px-4"
            onClick={() => reaction && onExploreInChat?.(envelope, reaction)}
          >
            💬 Explore in chat
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="rounded-full px-4"
            onClick={() => onQuickAction?.(envelope, 'ack')}
          >
            → That&apos;s enough
          </Button>
        </div>
      ) : actions ? (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {scaleOptions.map((option) => (
              <Button
                key={`${envelope.id}-${option.value}`}
                type="button"
                size="sm"
                variant={option.value.startsWith('agree') ? 'default' : 'secondary'}
                className="rounded-full px-4"
                onClick={() => onQuickAction?.(envelope, option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-foreground/60">
            {actions.helperText ?? 'Let us know how much this resonates.'}
          </p>
          {actions.allowNotes ? (
            <span className="mt-1 block text-[11px] text-foreground/50">
              You can add an optional note after selecting.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
