'use client'

import type { InboxEnvelope, InboxQuickActionValue, InboxButtonActionSchema } from '@/types/inbox'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { UniversalActions } from '@/components/inbox/UniversalActions'

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

  // Check for new button actions first, fall back to scale4
  const buttonActions = envelope.actions?.kind === 'buttons' ? envelope.actions as InboxButtonActionSchema : null
  const scaleActions = envelope.actions?.kind === 'scale4' ? envelope.actions : null

  const scaleOptions: { value: InboxQuickActionValue; label: string }[] = scaleActions
    ? [
        { value: 'agree_strong', label: scaleActions.agreeStrongLabel ?? DEFAULT_SCALE.agreeStrong },
        { value: 'agree', label: scaleActions.agreeLabel ?? DEFAULT_SCALE.agree },
        { value: 'disagree', label: scaleActions.disagreeLabel ?? DEFAULT_SCALE.disagree },
        { value: 'disagree_strong', label: scaleActions.disagreeStrongLabel ?? DEFAULT_SCALE.disagreeStrong },
      ]
    : []

  const lastAction = (envelope.metadata as Record<string, unknown> | undefined)?.lastAction as
    | InboxQuickActionValue
    | undefined

  // Determine reaction type - for button actions, any selection is considered positive
  const reaction: 'confirmed' | 'denied' | undefined = lastAction
    ? buttonActions
      ? 'confirmed'  // Button actions are always treated as engagement
      : lastAction.startsWith('agree') || lastAction === 'yes' || lastAction === 'strong_yes'
        ? 'confirmed'
        : 'denied'
    : undefined
  const actioned = Boolean(reaction)

  const handleButtonAction = (value: string, freeText?: string) => {
    // Pass the action value to the parent handler
    onQuickAction?.(envelope, value)
  }

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
            ✓ {reaction === 'confirmed' ? 'Responded' : 'Dismissed'}
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
      ) : buttonActions ? (
        <div className="mt-4">
          <UniversalActions
            actions={buttonActions}
            onAction={handleButtonAction}
          />
        </div>
      ) : scaleActions ? (
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
            {scaleActions.helperText ?? 'Tell us if this nudge fits for you.'}
          </p>
          {scaleActions.allowNotes ? (
            <span className="mt-1 block text-[11px] text-foreground/50">
              You can add an optional note after selecting.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
