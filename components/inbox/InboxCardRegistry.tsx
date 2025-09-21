'use client'

import type { InboxEnvelope, InboxQuickActionValue } from '@/types/inbox'
import { InsightSpotlightCard, type InsightSpotlightEnvelope } from '@/components/inbox/cards/InsightSpotlightCard'

export interface InboxCardRegistryContext {
  onOpen?: (envelope: InboxEnvelope) => void
  onQuickAction?: (envelope: InboxEnvelope, action: InboxQuickActionValue) => void
}

export function renderInboxCard(envelope: InboxEnvelope, context: InboxCardRegistryContext) {
  switch (envelope.type) {
    case 'insight_spotlight':
      return (
        <InsightSpotlightCard
          key={envelope.id}
          envelope={envelope as InsightSpotlightEnvelope}
          onOpen={(entry) => context.onOpen?.(entry)}
          onQuickAction={(entry, action) => context.onQuickAction?.(entry, action)}
        />
      )
    case 'nudge':
    case 'cta':
    case 'notification':
    default:
      return (
        <div
          key={envelope.id}
          className="rounded-xl border border-border/40 bg-card/10 p-4 text-xs text-foreground/60"
        >
          Additional inbox content type {envelope.type} is not implemented yet.
        </div>
      )
  }
}
