export type InboxItemSourceType = 'insight' | 'follow_up' | string

export type InboxItemStatus = 'pending' | 'revealed' | 'dismissed' | 'snoozed' | string

export interface InboxContent {
  title?: string
  body?: string
  evidence?: unknown
  [key: string]: unknown
}

export interface InboxItem {
  id: string
  userId: string
  sourceType: InboxItemSourceType
  status: InboxItemStatus
  partId: string | null
  content: InboxContent | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

// Inbox feed envelope types used by client-side normalization helpers

export type InboxMessageType = 'insight_spotlight' | 'nudge' | 'cta' | 'notification'
export type InboxEnvelopeSource = 'network' | 'fallback' | 'supabase' | 'edge'

export type InboxEventType = 'delivered' | 'opened' | 'actioned'
export type InboxQuickActionValue =
  | 'agree_strong'
  | 'agree'
  | 'disagree'
  | 'disagree_strong'
  | 'ack'

export interface InboxCTA {
  label: string
  href?: string
  actionId?: string
  intent?: 'primary' | 'secondary'
  helperText?: string
  target?: '_self' | '_blank'
  analyticsTag?: string
}

export interface InboxScaleActionSchema {
  kind: 'scale4'
  agreeStrongLabel?: string
  agreeLabel?: string
  disagreeLabel?: string
  disagreeStrongLabel?: string
  helperText?: string
  allowNotes?: boolean
}

export interface InboxAcknowledgeActionSchema {
  kind: 'acknowledge'
  label?: string
  helperText?: string
  allowNotes?: boolean
}

export type InboxActionSchema = InboxScaleActionSchema | InboxAcknowledgeActionSchema

export interface InboxEnvelopeBase {
  id: string
  type: InboxMessageType
  createdAt: string
  updatedAt: string | null
  expiresAt: string | null
  readAt: string | null
  source: InboxEnvelopeSource
  priority?: number
  tags?: string[]
  actions?: InboxActionSchema
  metadata?: Record<string, unknown>
}

export interface InsightSpotlightDetailSource {
  label: string
  url: string
}

export interface InsightSpotlightEvidenceReference {
  type: string
  sessionId?: string
  sessionLabel?: string
  sessionUrl?: string
  metadata?: Record<string, unknown>
}

export interface InsightSpotlightDetail {
  body?: string
  sources?: InsightSpotlightDetailSource[]
  evidence?: InsightSpotlightEvidenceReference[]
}

export interface InsightSpotlightEvidenceItem {
  id: string
  type: string
  summary?: string
  quote?: string
  sessionId?: string
  sessionLabel?: string
  occurredAt?: string
  confidence?: number
  metadata?: Record<string, unknown>
}

export interface InsightSpotlightMessage {
  insightId: string
  title: string
  summary: string
  prompt?: string
  readingTimeMinutes?: number
  detail?: InsightSpotlightDetail
  evidence?: InsightSpotlightEvidenceItem[]
  cta?: InboxCTA
}

export interface NudgeMessage {
  headline: string
  body: string
  cta?: InboxCTA
}

export interface CallToActionMessage {
  title: string
  description: string
  action: InboxCTA
}

export interface NotificationLink {
  label: string
  href: string
  target?: '_self' | '_blank'
  analyticsTag?: string
}

export interface NotificationMessage {
  title: string
  body: string
  unread?: boolean
  link?: NotificationLink
}

export type InsightSpotlightEnvelope = InboxEnvelopeBase & {
  type: 'insight_spotlight'
  payload: InsightSpotlightMessage
}

export type NudgeEnvelope = InboxEnvelopeBase & {
  type: 'nudge'
  payload: NudgeMessage
}

export type CallToActionEnvelope = InboxEnvelopeBase & {
  type: 'cta'
  payload: CallToActionMessage
}

export type NotificationEnvelope = InboxEnvelopeBase & {
  type: 'notification'
  payload: NotificationMessage
}

export type InboxEnvelope =
  | InsightSpotlightEnvelope
  | NudgeEnvelope
  | CallToActionEnvelope
  | NotificationEnvelope

export type InboxFeedVariant = 'pragmatic' | 'clean'

export type InboxAnalyticsEvent =
  | 'inbox_feed_loaded'
  | 'inbox_card_opened'
  | 'inbox_card_dismissed'
  | 'inbox_quick_action'
  | 'inbox_notes_submitted'

export interface InboxAnalyticsPayload {
  envelopeId: string
  messageType: InboxMessageType
  source: InboxEnvelopeSource
  metadata?: Record<string, unknown>
}

export interface InboxFeedResponse {
  data: InboxEnvelope[]
  generatedAt?: string
  source?: InboxEnvelopeSource | 'fallback'
  variant?: InboxFeedVariant
  reason?: string
  nextCursor?: string | null
}

export interface InboxFeedResult {
  envelopes: InboxEnvelope[]
  variant: InboxFeedVariant
  source: InboxEnvelopeSource | 'fallback'
  generatedAt?: string
  reason?: string
  nextCursor?: string | null
}

export interface InboxActionRequest {
  subjectId: string
  eventType?: InboxEventType
  action?: InboxQuickActionValue
  notes?: string
  messageType?: InboxMessageType
  source?: InboxEnvelopeSource | 'fallback'
  attributes?: Record<string, unknown>
}
