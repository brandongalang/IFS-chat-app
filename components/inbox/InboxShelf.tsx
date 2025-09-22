'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { emitInboxEvent } from '@/lib/analytics/inbox'
import { renderInboxCard } from '@/components/inbox/InboxCardRegistry'
import { useInboxFeed } from '@/hooks/useInboxFeed'
import type {
  InboxEnvelope,
  InboxFeedVariant,
  InboxQuickActionValue,
} from '@/types/inbox'

interface InboxShelfProps {
  variant?: InboxFeedVariant
  className?: string
}

export function InboxShelf({ variant = 'pragmatic', className }: InboxShelfProps) {
  const {
    status,
    envelopes,
    reload,
    source,
    variant: activeVariant,
    markAsRead,
    submitAction,
  } = useInboxFeed({ variant })
  const [activeEnvelope, setActiveEnvelope] = useState<InboxEnvelope | null>(null)
  const [pendingAction, setPendingAction] = useState<{
    envelope: InboxEnvelope
    action: InboxQuickActionValue
  } | null>(null)
  const [noteDraft, setNoteDraft] = useState('')

  const hasPreviewBadge = useMemo(() => source === 'fallback', [source])

  const handleOpen = (envelope: InboxEnvelope) => {
    markAsRead(envelope.id)
    setActiveEnvelope(envelope)
    emitInboxEvent('inbox_card_opened', {
      envelopeId: envelope.id,
      messageType: envelope.type,
      source: envelope.source,
      metadata: { variant: activeVariant },
    })
  }

  const handleClose = () => {
    if (activeEnvelope) {
      emitInboxEvent('inbox_card_dismissed', {
        envelopeId: activeEnvelope.id,
        messageType: activeEnvelope.type,
        source: activeEnvelope.source,
        metadata: { variant: activeVariant },
      })
    }
    setActiveEnvelope(null)
  }

  const completeQuickAction = async (
    envelope: InboxEnvelope,
    action: InboxQuickActionValue,
    notes?: string,
  ) => {
    try {
      await submitAction(envelope.id, action, notes)
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[inbox] quick action failed', error)
      }
    } finally {
      setPendingAction(null)
      setNoteDraft('')
    }
  }

  const handleQuickAction = (envelope: InboxEnvelope, action: InboxQuickActionValue) => {
    markAsRead(envelope.id)
    if (envelope.actions?.kind === 'boolean' && envelope.actions.allowNotes) {
      setPendingAction({ envelope, action })
      setNoteDraft('')
      return
    }
    void completeQuickAction(envelope, action)
  }

  return (
    <section
      className={cn(
        'col-span-2 rounded-xl border border-border/40 bg-card/20 backdrop-blur p-4 mt-2',
        className,
      )}
      aria-labelledby="today-inbox-heading"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="today-inbox-heading"
          className="text-xs font-semibold tracking-[0.24em] text-foreground/70"
        >
          INBOX
        </h2>
        <div className="flex items-center gap-2">
          {hasPreviewBadge ? (
            <span className="rounded-full border border-border/60 px-2 py-1 text-[10px] uppercase tracking-wide text-foreground/60">
              Preview data
            </span>
          ) : null}
          {status === 'error' ? (
            <button
              type="button"
              onClick={reload}
              className="text-[11px] underline text-foreground/70 hover:text-foreground"
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {status === 'loading' ? (
          <div className="animate-pulse rounded-lg border border-border/30 bg-card/10 p-4 text-sm text-foreground/50">
            Loading inbox…
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            We could not reach your inbox. Please retry in a moment.
          </div>
        ) : null}

        {status === 'empty' ? (
          <div className="rounded-lg border border-border/30 bg-card/10 p-4 text-sm text-foreground/60">
            Nothing new just yet—check back after your next reflection.
          </div>
        ) : null}

        {(status === 'success' || (status === 'loading' && envelopes.length)) ? (
          <div className="space-y-3">
            {envelopes.map((envelope) => (
              <div key={envelope.id}>
                {renderInboxCard(envelope, {
                  onOpen: handleOpen,
                  onQuickAction: (entry, action) => handleQuickAction(entry, action),
                })}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <Dialog open={Boolean(activeEnvelope)} onOpenChange={(isOpen) => (!isOpen ? handleClose() : null)}>
        <DialogContent>
          {activeEnvelope ? renderEnvelopeDetail(activeEnvelope) : null}
          <DialogFooter className="pt-2">
            {renderEnvelopeFooter(activeEnvelope, handleClose)}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null)
            setNoteDraft('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share a bit more?</DialogTitle>
            <DialogDescription>
              Optional notes help us fine-tune future nudges.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder="Add more context (optional)"
            className="min-h-[120px]"
          />
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (pendingAction) {
                  void completeQuickAction(pendingAction.envelope, pendingAction.action)
                }
              }}
            >
              Skip notes
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (pendingAction) {
                  void completeQuickAction(pendingAction.envelope, pendingAction.action, noteDraft.trim() || undefined)
                }
              }}
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function renderEnvelopeDetail(envelope: InboxEnvelope) {
  switch (envelope.type) {
    case 'insight_spotlight':
      return renderInsightDetail(envelope)
    case 'nudge':
    case 'cta':
    case 'notification':
    default:
      return (
        <DialogHeader>
          <DialogTitle>Coming soon</DialogTitle>
          <DialogDescription>We are preparing an updated experience for this inbox item.</DialogDescription>
        </DialogHeader>
      )
  }
}

function renderInsightDetail(envelope: Extract<InboxEnvelope, { type: 'insight_spotlight' }>) {
  const { payload } = envelope
  return (
    <>
      <DialogHeader>
        <DialogTitle>{payload.title}</DialogTitle>
        <DialogDescription>{payload.summary}</DialogDescription>
      </DialogHeader>
      <ScrollArea className="max-h-64 pr-4 text-sm text-foreground/80">
        {payload.detail?.body ? (
          <p className="whitespace-pre-wrap leading-relaxed">{payload.detail.body}</p>
        ) : null}
        {payload.detail?.sources?.length ? (
          <div className="mt-4 space-y-2 text-xs">
            <div className="font-semibold uppercase tracking-wide text-foreground/60">Sources</div>
            <ul className="space-y-1">
              {payload.detail.sources.map((source) => (
                <li key={`${envelope.id}-${source.url}`}>
                  <Link
                    href={source.url}
                    className="text-foreground/70 underline hover:text-foreground"
                  >
                    {source.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </ScrollArea>
    </>
  )
}

function renderEnvelopeFooter(envelope: InboxEnvelope | null, onClose: () => void) {
  if (!envelope) return null
  if (envelope.type === 'insight_spotlight' && envelope.payload.cta?.href) {
    return (
      <Link
        href={envelope.payload.cta.href}
        onClick={onClose}
        target={envelope.payload.cta.target || '_self'}
        className="inline-flex items-center justify-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:bg-foreground/90"
      >
        {envelope.payload.cta.label}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={onClose}
      className="inline-flex items-center justify-center rounded-full border border-border/60 px-4 py-2 text-sm text-foreground/70"
    >
      Close
    </button>
  )
}
