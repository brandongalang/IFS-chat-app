'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { emitInboxEvent } from '@/lib/analytics/inbox'
import { getMockInboxEnvelopes } from '@/lib/inbox/mockData'
import { fetchInboxFeed, submitInboxEvent } from '@/lib/inbox/client'
import type {
  InboxEnvelope,
  InboxFeedVariant,
  InboxQuickActionValue,
} from '@/types/inbox'

export interface InboxFeedState {
  status: 'loading' | 'success' | 'empty' | 'error'
  envelopes: InboxEnvelope[]
  error: Error | null
  source: 'network' | 'fallback'
  variant: InboxFeedVariant
}

export interface UseInboxFeedOptions {
  variant?: InboxFeedVariant
  fallback?: InboxEnvelope[]
}

interface UseInboxFeedReturn extends InboxFeedState {
  reload: () => Promise<void>
  markAsRead: (envelopeId: string) => void
  submitAction: (envelopeId: string, action: InboxQuickActionValue, notes?: string) => Promise<void>
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
  })

  const runFetch = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setState({ status: 'loading', envelopes: [], error: null, source: 'network', variant })

    try {
      const normalized = await fetchInboxFeed(variant, { signal: controller.signal })

      if (controller.signal.aborted) return

      if (!normalized.length) {
        setState({ status: 'empty', envelopes: [], error: null, source: 'network', variant })
        return
      }

      setState({ status: 'success', envelopes: normalized, error: null, source: 'network', variant })
      emitInboxEvent('inbox_feed_loaded', {
        envelopeId: normalized[0]?.id ?? 'unknown',
        messageType: normalized[0]?.type ?? 'insight_spotlight',
        source: 'network',
        metadata: { variant, count: normalized.length },
      })
    } catch (error) {
      if (controller.signal.aborted) return
      if (fallbackEnvelopes.length) {
        setState({ status: 'success', envelopes: fallbackEnvelopes, error: null, source: 'fallback', variant })
      } else {
        setState({
          status: 'error',
          envelopes: [],
          error: error instanceof Error ? error : new Error('Unknown inbox error'),
          source: 'network',
          variant,
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
    setState((prev) => ({
      ...prev,
      envelopes: prev.envelopes.map((envelope) =>
        envelope.id === envelopeId ? { ...envelope, readAt: envelope.readAt ?? new Date().toISOString() } : envelope,
      ),
    }))

    void submitInboxEvent({ subjectId: envelopeId, eventType: 'opened' }).catch((err) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[inbox] failed to submit opened event', err)
      }
    })
  }, [])

  const submitAction = useCallback(
    async (envelopeId: string, action: InboxQuickActionValue, notes?: string) => {
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
        messageType: state.envelopes.find((entry) => entry.id === envelopeId)?.type ?? 'insight_spotlight',
        source: state.source,
        metadata: {
          variant,
          action,
        },
      })

      try {
        await submitInboxEvent({
          subjectId: envelopeId,
          eventType: 'cta_clicked',
          action,
          notes,
        })
        if (notes) {
          emitInboxEvent('inbox_notes_submitted', {
            envelopeId,
            messageType: state.envelopes.find((entry) => entry.id === envelopeId)?.type ?? 'insight_spotlight',
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

  return {
    ...state,
    reload,
    markAsRead,
    submitAction,
  }
}
