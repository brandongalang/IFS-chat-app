'use client'

import type { InboxEnvelope, InboxQuickActionValue } from '@/types/inbox'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type NudgeEnvelope = Extract<InboxEnvelope, { type: 'nudge' }>

interface NudgeCardProps {
  envelope: NudgeEnvelope
  onOpen?: (envelope: NudgeEnvelope) => void
  onQuickAction?: (envelope: NudgeEnvelope, action: InboxQuickActionValue) => void
  onExploreInChat?: (envelope: NudgeEnvelope, reaction: 'confirmed' | 'denied') => void
  className?: string
}

const DEFAULT_SCALE = {
  agreeStrong: 'Agree a lot',
  agree: 'Agree a little',
  disagree: 'Disagree a little',
  disagreeStrong: 'Disagree a lot',
}

export function NudgeCard({ envelope, onOpen, onQuickAction, onExploreInChat, className }: NudgeCardProps) {
  const { payload } = envelope
  const actions = envelope.actions?.kind === 'scale4' ? envelope.actions : null
  const scaleOptions: { value: InboxQuickActionValue; label: string }[] = actions
    ? [
        { value: 'agree_strong', label: actions.agreeStrongLabel ?? DEFAULT_SCALE.agreeStrong },
        { value: 'agree', label: actions.agreeLabel ?? DEFAULT_SCALE.agree },
        { value: 'disagree', label: actions.disagreeLabel ?? DEFAULT_SCALE.disagree },
        { value: 'disagree_strong', label: actions.disagreeStrongLabel ?? DEFAULT_SCALE.disagreeStrong },
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
    <div className={cn('rounded-xl border border-border/40 bg-card/20 backdrop-blur p-4', actioned && 'opacity-80', className)}>
      <button
        type="button"
        onClick={() => onOpen?.(envelope)}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`Open nudge ${payload.headline}`}
      >
        <div className="text-[10px] font-semibold tracking-[0.24em] text-foreground/60">NUDGE</div>
        <div className="mt-3">
          <p className="text-base font-semibold leading-tight text-foreground">{payload.headline}</p>
          <p className="mt-2 text-sm text-foreground/80">{payload.body}</p>
        </div>
        {payload.cta?.helperText ? (
          <p className="mt-3 text-xs text-foreground/60">{payload.cta.helperText}</p>
        ) : (
          <p className="mt-3 text-xs text-foreground/60">Tap to see supporting details.</p>
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
            {actions.helperText ?? 'Tell us if this nudge fits for you.'}
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
