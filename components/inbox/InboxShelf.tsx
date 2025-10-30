'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { packChatContext, saveContextToSession } from '@/lib/inbox/chat-bridge'
import type {
  InboxEnvelope,
  InboxFeedVariant,
  InboxQuickActionValue,
} from '@/types/inbox'

interface InboxShelfProps {
  variant?: InboxFeedVariant
  className?: string
}

type CtaEnvelope = Extract<InboxEnvelope, { type: 'cta' }>

type InboxEventName = Parameters<typeof emitInboxEvent>[0]

function emitEnvelopeEvent(
  eventName: InboxEventName,
  envelope: InboxEnvelope,
  metadata?: Record<string, unknown>
) {
  emitInboxEvent(eventName, {
    envelopeId: envelope.id,
    sourceId: envelope.sourceId ?? envelope.id,
    messageType: envelope.type,
    source: envelope.source,
    metadata,
  })
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
    recordCta,
    generateObservations,
    isGenerating,
    queueStatus,
    lastGeneratedAt,
  } = useInboxFeed({ variant })
  const router = useRouter()
  const [activeEnvelope, setActiveEnvelope] = useState<InboxEnvelope | null>(null)
  const [pendingAction, setPendingAction] = useState<{
    envelope: InboxEnvelope
    action: InboxQuickActionValue
  } | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const skipDismissRef = useRef(false)

  const hasPreviewBadge = useMemo(() => source === 'fallback', [source])

  const handleOpen = (envelope: InboxEnvelope) => {
    markAsRead(envelope.id)
    setActiveEnvelope(envelope)
    emitEnvelopeEvent('inbox_card_opened', envelope, { variant: activeVariant })
  }

  const closeActiveEnvelope = (options?: { trackDismiss?: boolean }) => {
    const trackDismiss = options?.trackDismiss ?? true
    if (trackDismiss && activeEnvelope) {
      emitEnvelopeEvent('inbox_card_dismissed', activeEnvelope, { variant: activeVariant })
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
    const allowNotes =
      (envelope.actions?.kind === 'scale4' || envelope.actions?.kind === 'acknowledge') &&
      envelope.actions.allowNotes
    if (allowNotes) {
      setPendingAction({ envelope, action })
      setNoteDraft('')
      return
    }
    void completeQuickAction(envelope, action)
  }

  const handleExploreInChat = (envelope: InboxEnvelope, reaction: 'confirmed' | 'denied') => {
    try {
      const ctx = packChatContext(envelope, reaction)
      saveContextToSession(ctx)
      emitEnvelopeEvent('inbox_cta_clicked', envelope, { reaction })
      router.push('/chat')
    } catch (error) {
      console.warn('[inbox] failed to prepare chat context', error)
    }
  }

  const handleCtaVisit = (envelope: CtaEnvelope, options?: { closeDetail?: boolean }) => {
    void recordCta(envelope)
    if (options?.closeDetail) {
      setActiveEnvelope((current) => (current?.id === envelope.id ? null : current))
    }
  }

  const handleSyncInbox = async () => {
    try {
      await generateObservations()
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[inbox] sync failed', error)
      }
      // Error is already set in state by the hook
    }
  }

  const canSync = useMemo(() => {
    if (isGenerating) return false
    if (queueStatus && !queueStatus.hasCapacity) return false

    // Check 24-hour cooldown
    if (lastGeneratedAt) {
      const lastGenTime = new Date(lastGeneratedAt).getTime()
      const now = Date.now()
      const hoursSinceLastGen = (now - lastGenTime) / (1000 * 60 * 60)
      if (hoursSinceLastGen < 24) return false
    }

    return true
  }, [isGenerating, queueStatus, lastGeneratedAt])

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
          <button
            type="button"
            onClick={handleSyncInbox}
            disabled={!canSync}
            className={cn(
              'text-[11px] underline transition',
              canSync
                ? 'text-foreground/70 hover:text-foreground'
                : 'text-foreground/30 cursor-not-allowed',
            )}
            title={
              isGenerating
                ? 'Syncing...'
                : !queueStatus?.hasCapacity
                ? 'Inbox is full'
                : lastGeneratedAt && (Date.now() - new Date(lastGeneratedAt).getTime()) / (1000 * 60 * 60) < 24
                ? 'Wait 24 hours between syncs'
                : 'Sync new observations'
            }
          >
            {isGenerating ? 'Syncing...' : 'Sync Inbox'}
          </button>
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
                  onCta: (entry) => handleCtaVisit(entry),
                  onExploreInChat: (entry, reaction) => handleExploreInChat(entry, reaction),
                })}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <Dialog
        open={Boolean(activeEnvelope)}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            if (skipDismissRef.current) {
              skipDismissRef.current = false
              return
            }
            closeActiveEnvelope()
          }
        }}
      >
        <DialogContent>
          {activeEnvelope ? renderEnvelopeDetail(activeEnvelope) : null}
          <DialogFooter className="pt-2">
            {activeEnvelope?.type === 'cta'
              ? renderCtaFooter(activeEnvelope, {
                  onClose: () => closeActiveEnvelope({ trackDismiss: false }),
                  onVisit: (envelope) => {
                    skipDismissRef.current = true
                    handleCtaVisit(envelope, { closeDetail: true })
                  },
                })
              : renderEnvelopeFooter(activeEnvelope, () => closeActiveEnvelope())}
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
      return renderNudgeDetail(envelope)
    case 'notification':
      return renderNotificationDetail(envelope)
    case 'cta':
      return renderCtaDetail(envelope)
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

function renderNudgeDetail(envelope: Extract<InboxEnvelope, { type: 'nudge' }>) {
  const { payload } = envelope
  return (
    <>
      <DialogHeader>
        <DialogTitle>{payload.headline}</DialogTitle>
        <DialogDescription>{payload.body}</DialogDescription>
      </DialogHeader>
      {payload.cta ? (
        <div className="mt-4">
          <Link
            href={payload.cta.href ?? '#'}
            target={payload.cta.target ?? '_self'}
            className="inline-flex items-center text-sm text-foreground underline"
          >
            {payload.cta.label}
          </Link>
        </div>
      ) : null}
    </>
  )
}

function renderNotificationDetail(envelope: Extract<InboxEnvelope, { type: 'notification' }>) {
  const { payload } = envelope
  return (
    <DialogHeader>
      <DialogTitle>{payload.title}</DialogTitle>
      <DialogDescription>{payload.body}</DialogDescription>
    </DialogHeader>
  )
}

function renderCtaDetail(envelope: CtaEnvelope) {
  const { payload } = envelope
  return (
    <>
      <DialogHeader>
        <DialogTitle>{payload.title}</DialogTitle>
        <DialogDescription>{payload.description}</DialogDescription>
      </DialogHeader>
      {payload.action.helperText ? (
        <p className="mt-4 text-sm text-foreground/70">{payload.action.helperText}</p>
      ) : null}
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

  if (envelope.type === 'nudge' && envelope.payload.cta?.href) {
    return (
      <Link
        href={envelope.payload.cta.href}
        onClick={onClose}
        target={envelope.payload.cta.target ?? '_self'}
        className="inline-flex items-center justify-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:bg-foreground/90"
      >
        {envelope.payload.cta.label}
      </Link>
    )
  }

  if (envelope.type === 'notification' && envelope.payload.link) {
    return (
      <Link
        href={envelope.payload.link.href}
        onClick={onClose}
        target={envelope.payload.link.target ?? '_self'}
        className="inline-flex items-center justify-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:bg-foreground/90"
      >
        {envelope.payload.link.label}
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

function renderCtaFooter(
  envelope: CtaEnvelope,
  handlers: {
    onClose: () => void
    onVisit: (envelope: CtaEnvelope) => void
  },
) {
  const { action } = envelope.payload
  const intent = action.intent === 'secondary' ? 'secondary' : 'default'
  const href = action.href ?? '#'
  const target = action.target ?? '_self'

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      <button
        type="button"
        onClick={handlers.onClose}
        className="inline-flex items-center justify-center rounded-full border border-border/60 px-4 py-2 text-sm text-foreground/70"
      >
        Close
      </button>
      <Button
        asChild
        variant={intent}
        size="sm"
        className="rounded-full px-4"
        onClick={() => handlers.onVisit(envelope)}
      >
        <Link href={href} target={target}>
          {action.label}
        </Link>
      </Button>
    </div>
  )
}
