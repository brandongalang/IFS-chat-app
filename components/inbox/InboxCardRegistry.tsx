'use client'

import type { InboxEnvelope, InboxQuickActionValue } from '@/types/inbox'
import { InsightSpotlightCard, type InsightSpotlightEnvelope } from '@/components/inbox/cards/InsightSpotlightCard'
import { NudgeCard, type NudgeEnvelope } from '@/components/inbox/cards/NudgeCard'
import { NotificationCard, type NotificationEnvelope } from '@/components/inbox/cards/NotificationCard'
import { CallToActionCard, type CallToActionEnvelope } from '@/components/inbox/cards/CallToActionCard'

export interface InboxCardRegistryContext {
  onOpen?: (envelope: InboxEnvelope) => void
  onQuickAction?: (envelope: InboxEnvelope, action: InboxQuickActionValue) => void
  onCta?: (envelope: CallToActionEnvelope) => void
  onExploreInChat?: (envelope: InboxEnvelope, reaction: 'confirmed' | 'denied') => void
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
          onExploreInChat={(entry, reaction) => context.onExploreInChat?.(entry, reaction)}
        />
      )
    case 'nudge':
      return (
        <NudgeCard
          key={envelope.id}
          envelope={envelope as NudgeEnvelope}
          onOpen={(entry) => context.onOpen?.(entry)}
          onQuickAction={(entry, action) => context.onQuickAction?.(entry, action)}
          onExploreInChat={(entry, reaction) => context.onExploreInChat?.(entry, reaction)}
        />
      )
    case 'notification':
      return (
        <NotificationCard
          key={envelope.id}
          envelope={envelope as NotificationEnvelope}
          onOpen={(entry) => context.onOpen?.(entry)}
          onQuickAction={(entry, action) => context.onQuickAction?.(entry, action)}
        />
      )
    case 'cta':
      return (
        <CallToActionCard
          key={envelope.id}
          envelope={envelope as CallToActionEnvelope}
          onOpen={(entry) => context.onOpen?.(entry)}
          onVisit={(entry) => context.onCta?.(entry)}
        />
      )
    // Unified inbox types: reuse InsightSpotlightCard for MVP
    case 'observation':
    case 'question':
    case 'pattern':
      return (
        <InsightSpotlightCard
          key={envelope.id}
          envelope={envelope as any}
          onOpen={(entry) => context.onOpen?.(entry)}
          onQuickAction={(entry, action) => context.onQuickAction?.(entry, action)}
          onExploreInChat={(entry, reaction) => context.onExploreInChat?.(entry, reaction)}
        />
      )
    case 'session_summary':
    case 'follow_up':
      return (
        <NudgeCard
          key={envelope.id}
          envelope={envelope as any}
          onOpen={(entry) => context.onOpen?.(entry)}
          onQuickAction={(entry, action) => context.onQuickAction?.(entry, action)}
          onExploreInChat={(entry, reaction) => context.onExploreInChat?.(entry, reaction)}
        />
      )
    default:
      return (
        <div className="rounded-xl border border-border/40 bg-card/10 p-4 text-xs text-foreground/60">
          Additional inbox content type is not implemented yet.
        </div>
      )
  }
}
