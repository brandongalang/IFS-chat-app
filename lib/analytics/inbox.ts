import { track } from '@/lib/analytics'
import type { InboxAnalyticsEvent, InboxAnalyticsPayload } from '@/types/inbox'

export function emitInboxEvent(
  event: InboxAnalyticsEvent,
  payload: InboxAnalyticsPayload,
): void {
  const finalPayload = {
    ...payload,
    timestamp: new Date().toISOString(),
  }

  try {
    track(event, finalPayload)
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[analytics:inbox] failed to emit event', event, error)
    }
  }
}
