'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { emitInboxEvent } from '@/lib/analytics/inbox'
import { getMockInboxEnvelopes } from '@/lib/inbox/mockData'
import { fetchInboxFeed, submitInboxEvent } from '@/lib/inbox/client'
import type {
  InboxEnvelope,
  InboxEnvelopeSource,
  InboxFeedVariant,
  InboxQuickActionValue,
} from '@/types/inbox'

export interface InboxFeedState {
  status: 'loading' | 'success' | 'empty' | 'error'
  envelopes: InboxEnvelope[]
  error: Error | null
  source: InboxEnvelopeSource | 'fallback'
  variant: InboxFeedVariant
  reason?: string
  generatedAt?: string
  nextCursor?: string | null
}

export interface UseInboxFeedOptions {
  variant?: InboxFeedVariant
  fallback?: InboxEnvelope[]
}

type CtaEnvelope = Extract<InboxEnvelope, { type: 'cta' }>

interface UseInboxFeedReturn extends InboxFeedState {
  reload: () => Promise<void>
  markAsRead: (envelopeId: string) => void
  submitAction: (envelopeId: string, action: InboxQuickActionValue, notes?: string) => Promise<void>
  recordCta: (envelope: CtaEnvelope) => Promise<void>
}

export function useInboxFeed(options: UseInboxFeedOptions = {}): UseInboxFeedReturn {
  const variant: InboxFeedVariant = options.variant ?? 'pragmatic'
  const controllerRef = useRef<AbortController | null>(null)

  const fallbackEnvelopes = useMemo(() => {
    if (Array.isArray(options.fallback) && options.fallback.length > 0) {
      return options.fallback
    }
    return getMockInboxEnvelopes()
  }, [options.fallback])

  const [state, setState] = useState<InboxFeedState>({
    status: 'loading',
    envelopes: [],
    error: null,
    source: 'network',
    variant,
    reason: undefined,
    generatedAt: undefined,
    nextCursor: null,
  })

  const runFetch = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setState({
      status: 'loading',
      envelopes: [],
      error: null,
      source: 'network',
      variant,
      reason: undefined,
      generatedAt: undefined,
      nextCursor: null,
    })

    try {
      const result = await fetchInboxFeed(variant, { signal: controller.signal })

      if (controller.signal.aborted) return

      if (!result.envelopes.length) {
        setState({
          status: 'empty',
          envelopes: [],
          error: null,
          source: result.source,
          variant: result.variant,
          reason: result.reason,
          generatedAt: result.generatedAt,
          nextCursor: null,
        })
        return
      }

      setState({
        status: 'success',
        envelopes: result.envelopes,
        error: null,
        source: result.source,
        variant: result.variant,
        reason: result.reason,
        generatedAt: result.generatedAt,
        nextCursor: result.nextCursor ?? null,
      })
      emitInboxEvent('inbox_feed_loaded', {
        envelopeId: result.envelopes[0]?.id ?? 'unknown',
        sourceId: result.envelopes[0]?.sourceId ?? result.envelopes[0]?.id,
        messageType: result.envelopes[0]?.type ?? 'insight_spotlight',
        source: result.source,
        metadata: {
          variant: result.variant,
          count: result.envelopes.length,
          reason: result.reason,
        },
      })
    } catch (error) {
      if (controller.signal.aborted) return
      if (fallbackEnvelopes.length) {
        setState({
          status: 'success',
          envelopes: fallbackEnvelopes,
          error: null,
          source: 'fallback',
          variant,
          reason: 'client_error',
          generatedAt: undefined,
          nextCursor: null,
        })
        emitInboxEvent('inbox_feed_loaded', {
          envelopeId: fallbackEnvelopes[0]?.id ?? 'unknown',
          sourceId: fallbackEnvelopes[0]?.sourceId ?? fallbackEnvelopes[0]?.id,
          messageType: fallbackEnvelopes[0]?.type ?? 'insight_spotlight',
          source: 'fallback',
          metadata: { variant, count: fallbackEnvelopes.length, reason: 'client_error' },
        })
      } else {
        setState({
          status: 'error',
          envelopes: [],
          error: error instanceof Error ? error : new Error('Unknown inbox error'),
          source: 'network',
          variant,
          reason: error instanceof Error ? error.message : 'unknown_error',
          generatedAt: undefined,
          nextCursor: null,
        })
      }
    }
  }, [fallbackEnvelopes, variant])

  useEffect(() => {
    runFetch()
    return () => {
      controllerRef.current?.abort()
    }
  }, [runFetch])

  const reload = useCallback(async () => {
    await runFetch()
  }, [runFetch])

  const markAsRead = useCallback((envelopeId: string) => {
    const envelope = state.envelopes.find((entry) => entry.id === envelopeId)
    setState((prev) => ({
      ...prev,
      envelopes: prev.envelopes.map((envelope) =>
        envelope.id === envelopeId ? { ...envelope, readAt: envelope.readAt ?? new Date().toISOString() } : envelope,
      ),
    }))

    void submitInboxEvent({
      subjectId: envelope?.sourceId ?? envelopeId,
      eventType: 'opened',
      messageType: envelope?.type,
      source: envelope?.source ?? state.source,
    }).catch((err) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[inbox] failed to submit opened event', err)
      }
    })
  }, [state.envelopes, state.source])

  const submitAction = useCallback(
    async (envelopeId: string, action: InboxQuickActionValue, notes?: string) => {
      const envelope = state.envelopes.find((entry) => entry.id === envelopeId)
      setState((prev) => ({
        ...prev,
        envelopes: prev.envelopes.map((envelope) =>
          envelope.id === envelopeId
            ? {
                ...envelope,
                readAt: envelope.readAt ?? new Date().toISOString(),
                metadata: {
                  ...envelope.metadata,
                  lastAction: action,
                },
              }
            : envelope,
        ),
      }))

      emitInboxEvent('inbox_quick_action', {
        envelopeId,
        sourceId: envelope?.sourceId ?? envelopeId,
        messageType: envelope?.type ?? 'insight_spotlight',
        source: state.source,
        metadata: {
          variant,
          action,
        },
      })

      try {
        if (envelope?.source === 'supabase') {
          const actionResponse = await fetch(`/api/inbox/${envelopeId}/action`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action,
              notes,
            }),
          })

          if (!actionResponse.ok && actionResponse.status !== 404) {
            throw new Error(`Failed to persist inbox action (${actionResponse.status})`)
          }
        }

        await submitInboxEvent({
          subjectId: envelope?.sourceId ?? envelopeId,
          eventType: 'actioned',
          action,
          notes,
          messageType: envelope?.type,
          source: envelope?.source ?? state.source,
        })
        setState((prev) => {
          const remaining = prev.envelopes.filter((entry) => entry.id !== envelopeId)
          return {
            ...prev,
            envelopes: remaining,
            status: remaining.length ? prev.status : 'empty',
          }
        })
        if (notes) {
          emitInboxEvent('inbox_notes_submitted', {
            envelopeId,
            sourceId: envelope?.sourceId ?? envelopeId,
            messageType: envelope?.type ?? 'insight_spotlight',
            source: state.source,
            metadata: {
              variant,
              hasNotes: true,
            },
          })
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[inbox] quick action submission failed', error)
        }
        throw error
      }
    },
    [state.envelopes, state.source, variant],
  )

  const recordCta = useCallback(
    async (envelope: CtaEnvelope) => {
      markAsRead(envelope.id)

      setState((prev) => ({
        ...prev,
        envelopes: prev.envelopes.map((entry) =>
          entry.id === envelope.id
            ? {
                ...entry,
                readAt: entry.readAt ?? new Date().toISOString(),
                metadata: {
                  ...(entry.metadata ?? {}),
                  lastAction: 'cta_clicked',
                },
              }
            : entry,
        ),
      }))

      emitInboxEvent('inbox_cta_clicked', {
        envelopeId: envelope.id,
        sourceId: envelope.sourceId ?? envelope.id,
        messageType: envelope.type,
        source: envelope.source,
        metadata: {
          variant,
          href: envelope.payload.action.href ?? undefined,
          actionId: envelope.payload.action.actionId ?? undefined,
          intent: envelope.payload.action.intent ?? undefined,
        },
      })

      try {
        await submitInboxEvent({
          subjectId: envelope.sourceId ?? envelope.id,
          eventType: 'actioned',
          action: 'cta_clicked',
          messageType: envelope.type,
          source: envelope.source ?? state.source,
          attributes: {
            href: envelope.payload.action.href ?? undefined,
            actionId: envelope.payload.action.actionId ?? undefined,
            target: envelope.payload.action.target ?? undefined,
          },
        })
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[inbox] CTA action submission failed', error)
        }
      }
    },
    [markAsRead, state.source, variant],
  )

  return {
    ...state,
    reload,
    markAsRead,
    submitAction,
    recordCta,
  }
}
