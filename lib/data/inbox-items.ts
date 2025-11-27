import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  InboxActionSchema,
  InboxActionButton,
  InboxButtonActionSchema,
  InboxContent,
  InboxCTA,
  InboxEnvelope,
  InboxEnvelopeSource,
  InboxItem,
  InboxMessageType,
  NudgeMessage,
  NotificationMessage,
  InsightSpotlightMessage,
  ObservationMessage,
  QuestionMessage,
  PatternMessage,
  SessionSummaryMessage,
  FollowUpMessage,
  EvidenceItem,
} from '@/types/inbox'
import type { Database } from '@/lib/types/database'

export type InboxItemRow = {
  user_id: string
  source_type: string
  status: string
  part_id: string | null
  content: unknown
  metadata: unknown
  source_id: string
  created_at: string
}

export function normalizeInboxContent(content: unknown): InboxContent | null {
  if (content == null) return null

  if (typeof content === 'string') {
    try {
      return JSON.parse(content)
    } catch {
      return { value: content }
    }
  }

  if (typeof content === 'object') {
    return content as InboxContent
  }

  return null
}

export function normalizeInboxMetadata(metadata: unknown): Record<string, unknown> | null {
  if (metadata == null) return null

  if (typeof metadata === 'string') {
    try {
      return JSON.parse(metadata) as Record<string, unknown>
    } catch {
      return { value: metadata }
    }
  }

  if (typeof metadata === 'object') {
    return metadata as Record<string, unknown>
  }

  return null
}

export function mapInboxRowToItem(row: InboxItemRow): InboxItem {
  return {
    id: row.source_id,
    sourceId: row.source_id,
    userId: row.user_id,
    sourceType: row.source_type,
    status: row.status,
    partId: row.part_id,
    content: normalizeInboxContent(row.content),
    metadata: normalizeInboxMetadata(row.metadata),
    createdAt: row.created_at,
  }
}

const SUPABASE_SOURCE: InboxEnvelopeSource = 'supabase'

const DEFAULT_SCALE_LABELS = {
  agreeStrong: 'Agree a lot',
  agree: 'Agree a little',
  disagree: 'Disagree a little',
  disagreeStrong: 'Disagree a lot',
}

const DEFAULT_ACK_LABEL = 'Got it'

type MetadataRecord = Record<string, unknown>

const toRecord = (value: unknown): MetadataRecord => {
  if (value && typeof value === 'object') {
    return value as MetadataRecord
  }
  return {}
}

const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }
  return undefined
}

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

const toBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const lowered = value.toLowerCase()
    if (['true', '1', 'yes', 'on'].includes(lowered)) return true
    if (['false', '0', 'no', 'off'].includes(lowered)) return false
  }
  return undefined
}

const toDateString = (value: unknown): string | null => {
  const raw = toTrimmedString(value)
  if (!raw) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

const collectTags = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined
  const tags = value
    .map((tag) => (typeof tag === 'string' ? tag.trim() : undefined))
    .filter((tag): tag is string => Boolean(tag))
  return tags.length ? tags : undefined
}

const buildScaleActions = (metadata: MetadataRecord): InboxActionSchema => {
  const labels = toRecord(metadata.response_labels)
  const helperText = toTrimmedString(metadata.action_helper_text)
  const allowNotes = toBoolean(metadata.allow_notes)
  return {
    kind: 'scale4',
    agreeStrongLabel:
      toTrimmedString(labels.agreeStrong) ?? toTrimmedString(labels.agree_strong) ?? DEFAULT_SCALE_LABELS.agreeStrong,
    agreeLabel: toTrimmedString(labels.agree) ?? DEFAULT_SCALE_LABELS.agree,
    disagreeLabel: toTrimmedString(labels.disagree) ?? DEFAULT_SCALE_LABELS.disagree,
    disagreeStrongLabel:
      toTrimmedString(labels.disagreeStrong) ?? toTrimmedString(labels.disagree_strong) ?? DEFAULT_SCALE_LABELS.disagreeStrong,
    helperText: helperText ?? undefined,
    allowNotes: allowNotes ?? true,
  }
}

const buildAcknowledgeActions = (metadata: MetadataRecord): InboxActionSchema => {
  const label = toTrimmedString(metadata.ack_label)
  const helperText = toTrimmedString(metadata.action_helper_text)
  const allowNotes = toBoolean(metadata.allow_notes)
  return {
    kind: 'acknowledge',
    label: label ?? DEFAULT_ACK_LABEL,
    helperText: helperText ?? undefined,
    allowNotes: allowNotes ?? true,
  }
}

/**
 * Build flexible button actions from agent-generated actions in metadata.
 * Returns null if no valid button actions are found.
 */
const buildButtonActions = (metadata: MetadataRecord): InboxButtonActionSchema | null => {
  const actionsData = toRecord(metadata.actions)
  if (!actionsData || !Array.isArray(actionsData.buttons)) {
    return null
  }

  const buttons: InboxActionButton[] = actionsData.buttons
    .map((btn: unknown) => {
      if (!btn || typeof btn !== 'object') return null
      const record = btn as MetadataRecord
      const value = toTrimmedString(record.value)
      const label = toTrimmedString(record.label)
      if (!value || !label) return null

      const button: InboxActionButton = { value, label }
      const shortLabel = toTrimmedString(record.shortLabel)
      const emoji = toTrimmedString(record.emoji)
      const variant = toTrimmedString(record.variant)

      if (shortLabel) button.shortLabel = shortLabel
      if (emoji) button.emoji = emoji
      if (variant === 'primary' || variant === 'secondary' || variant === 'ghost') {
        button.variant = variant
      }

      return button
    })
    .filter((btn): btn is InboxActionButton => btn !== null)

  if (buttons.length === 0) {
    return null
  }

  return {
    kind: 'buttons',
    buttons,
    allowFreeText: toBoolean(actionsData.allowFreeText) ?? false,
    freeTextPlaceholder: toTrimmedString(actionsData.freeTextPlaceholder),
    helperText: toTrimmedString(actionsData.helperText),
  }
}

/**
 * Resolve the best action schema for an item.
 * Prefers agent-generated button actions, falls back to legacy scale/acknowledge.
 */
const resolveActions = (metadata: MetadataRecord, fallbackKind: 'scale' | 'acknowledge'): InboxActionSchema => {
  // First, check for agent-generated button actions
  const buttonActions = buildButtonActions(metadata)
  if (buttonActions) {
    return buttonActions
  }

  // Fall back to legacy action schemas
  if (fallbackKind === 'acknowledge') {
    return buildAcknowledgeActions(metadata)
  }
  return buildScaleActions(metadata)
}

const resolveEnvelopeType = (item: InboxItem, metadata: MetadataRecord): InboxMessageType => {
  // Check unified inbox item type first (new system)
  const unifiedType = toTrimmedString(metadata.type)
  if (unifiedType === 'session_summary' || unifiedType === 'nudge' || 
      unifiedType === 'follow_up' || unifiedType === 'observation' || 
      unifiedType === 'question' || unifiedType === 'pattern') {
    return unifiedType as InboxMessageType
  }

  // Fallback to legacy insight detection (old system)
  const sourceType = item.sourceType
  const metaKind = toTrimmedString(metadata.kind)
  const insightType = toTrimmedString(metadata.insight_type)

  if (sourceType === 'part_follow_up' || metaKind === 'stale_part_follow_up') {
    return 'nudge'
  }

  if (sourceType === 'follow_up') {
    return 'nudge'
  }

  if (insightType === 'nudge' || insightType === 'follow_up') {
    return 'nudge'
  }

  if (insightType === 'notification' || metaKind === 'notification') {
    return 'notification'
  }

  return 'insight_spotlight'
}

const toInsightPayload = (item: InboxItem, content: MetadataRecord, metadata: MetadataRecord): InsightSpotlightMessage => {
  const title = toTrimmedString(content.title) ?? 'Insight update'
  const summary =
    toTrimmedString(content.summary) ?? toTrimmedString(content.body) ?? 'Open to explore this insight.'
  const prompt = toTrimmedString(content.prompt) ?? toTrimmedString(metadata.prompt)
  const detailBody = toTrimmedString(content.body) ?? undefined
  const sourcesRaw = Array.isArray(content.sources) ? content.sources : metadata.sources
  const sources = Array.isArray(sourcesRaw)
    ? sourcesRaw
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null
          const record = entry as MetadataRecord
          const label = toTrimmedString(record.label)
          const url = toTrimmedString(record.url)
          if (!label || !url) return null
          return { label, url }
        })
        .filter((entry): entry is { label: string; url: string } => Boolean(entry))
    : undefined

  const readingTime =
    toNumber(content.readingTimeMinutes ?? metadata.reading_time_minutes ?? metadata.readingTimeMinutes) ?? undefined

  const cta = normalizeCta(content.cta ?? metadata.cta)

  return {
    insightId: item.id,
    title,
    summary,
    prompt: prompt ?? undefined,
    readingTimeMinutes: typeof readingTime === 'number' ? Math.max(0, Math.round(readingTime)) : undefined,
    detail: detailBody || (sources && sources.length)
      ? {
          body: detailBody,
          sources,
        }
      : undefined,
    cta: cta ?? undefined,
  }
}

const toNudgePayload = (content: MetadataRecord, metadata: MetadataRecord): NudgeMessage => {
  const headline =
    toTrimmedString(content.title) ?? toTrimmedString(content.headline) ?? 'Gentle reminder'
  const body =
    toTrimmedString(content.body) ?? toTrimmedString(metadata.body) ??
    'Take a quick action that supports your practice.'
  const cta = normalizeCta(content.cta ?? metadata.cta)
  return {
    headline,
    body,
    cta: cta ?? undefined,
  }
}

const toNotificationPayload = (content: MetadataRecord, metadata: MetadataRecord): NotificationMessage => {
  const title = toTrimmedString(content.title) ?? toTrimmedString(metadata.title) ?? 'Update'
  const body =
    toTrimmedString(content.body) ?? toTrimmedString(metadata.body) ?? 'There is something new to review.'
  const unread = toBoolean(metadata.unread) ?? true
  const linkRecord = toRecord(content.link ?? metadata.link)
  const linkLabel = toTrimmedString(linkRecord.label)
  const linkHref = toTrimmedString(linkRecord.href)
  const linkTarget = toTrimmedString(linkRecord.target)
  const analyticsTag = toTrimmedString(linkRecord.analyticsTag)
  return {
    title,
    body,
    unread,
    link:
      linkLabel && linkHref
        ? {
            label: linkLabel,
            href: linkHref,
            target: linkTarget === '_blank' ? '_blank' : '_self',
            analyticsTag: analyticsTag ?? undefined,
          }
        : undefined,
  }
}

// Unified inbox type payload builders

const toEvidenceArray = (evidence: unknown): EvidenceItem[] | undefined => {
  if (!Array.isArray(evidence)) return undefined
  const items = evidence
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const record = item as MetadataRecord
      const type = toTrimmedString(record.type)
      const id = toTrimmedString(record.id)
      if (!type || !id) return null
      const context = toTrimmedString(record.context)
      const result: EvidenceItem = {
        type: type as EvidenceItem['type'],
        id,
      }
      if (context) {
        result.context = context
      }
      return result
    })
    .filter((item): item is EvidenceItem => Boolean(item))
  return items.length ? items : undefined
}

const toObservationPayload = (content: MetadataRecord, metadata: MetadataRecord): ObservationMessage => {
  const title = toTrimmedString(content.title) ?? 'Observation'
  const summary = toTrimmedString(content.summary) ?? 'An observation from your recent activity'
  const inference = toTrimmedString(content.inference) ?? toTrimmedString(content.body) ?? ''
  const evidence = toEvidenceArray(content.evidence ?? metadata.evidence)
  return {
    title,
    summary,
    inference,
    evidence,
  }
}

const toQuestionPayload = (content: MetadataRecord, metadata: MetadataRecord): QuestionMessage => {
  const title = toTrimmedString(content.title) ?? 'Question for reflection'
  const summary = toTrimmedString(content.summary) ?? 'Consider this question'
  const inference = toTrimmedString(content.inference) ?? toTrimmedString(content.body) ?? ''
  return {
    title,
    summary,
    inference,
  }
}

const toPatternPayload = (content: MetadataRecord, metadata: MetadataRecord): PatternMessage => {
  const title = toTrimmedString(content.title) ?? 'Pattern detected'
  const summary = toTrimmedString(content.summary) ?? 'A pattern emerged from your data'
  const inference = toTrimmedString(content.inference) ?? toTrimmedString(content.body) ?? ''
  const evidence = toEvidenceArray(content.evidence ?? metadata.evidence)
  return {
    title,
    summary,
    inference,
    evidence,
  }
}

const toSessionSummaryPayload = (content: MetadataRecord, metadata: MetadataRecord): SessionSummaryMessage => {
  const title = toTrimmedString(content.title) ?? 'Session summary'
  const summary = toTrimmedString(content.summary) ?? 'Key themes from your session'
  return {
    title,
    summary,
  }
}

const toFollowUpPayload = (content: MetadataRecord, metadata: MetadataRecord): FollowUpMessage => {
  const title = toTrimmedString(content.title) ?? 'Follow up'
  const summary = toTrimmedString(content.summary) ?? 'Something to explore further'
  const body = toTrimmedString(content.body) ?? toTrimmedString(metadata.body) ?? ''
  return {
    title,
    summary,
    body,
  }
}

const normalizeCta = (candidate: unknown): InboxCTA | null => {
  if (!candidate || typeof candidate !== 'object') return null
  const record = candidate as MetadataRecord
  const label = toTrimmedString(record.label)
  if (!label) return null
  const href = toTrimmedString(record.href)
  const actionId = toTrimmedString(record.actionId)
  const intent = toTrimmedString(record.intent)
  const helperText = toTrimmedString(record.helperText)
  const targetRaw = toTrimmedString(record.target)
  const analyticsTag = toTrimmedString(record.analyticsTag)
  return {
    label,
    href,
    actionId,
    intent: intent === 'secondary' ? 'secondary' : 'primary',
    helperText: helperText ?? undefined,
    target: targetRaw === '_blank' ? '_blank' : undefined,
    analyticsTag: analyticsTag ?? undefined,
  }
}

const readAtFromMetadata = (metadata: MetadataRecord): string | null => {
  return toDateString(metadata.revealed_at ?? metadata.read_at ?? metadata.last_opened_at)
}

const updatedAtFromMetadata = (metadata: MetadataRecord): string | null => {
  return toDateString(metadata.updated_at ?? metadata.actioned_at ?? metadata.revealed_at)
}

const expiresAtFromMetadata = (metadata: MetadataRecord): string | null => {
  return toDateString(metadata.expires_at)
}

const priorityFromMetadata = (metadata: MetadataRecord): number | undefined => {
  const priority = toNumber(metadata.priority)
  if (typeof priority === 'number') {
    return Math.max(0, Math.round(priority))
  }
  return undefined
}

export function mapInboxItemToEnvelope(item: InboxItem): InboxEnvelope | null {
  const metadata = toRecord(item.metadata)
  const content = toRecord(item.content)
  const messageType = resolveEnvelopeType(item, metadata)

  const base = {
    id: item.id,
    sourceId: item.sourceId ?? item.id,
    createdAt: toDateString(item.createdAt) ?? new Date(item.createdAt).toISOString(),
    updatedAt: updatedAtFromMetadata(metadata),
    expiresAt: expiresAtFromMetadata(metadata),
    readAt: readAtFromMetadata(metadata),
    source: SUPABASE_SOURCE,
    priority: priorityFromMetadata(metadata),
    tags: collectTags(metadata.tags ?? metadata.labels) ?? collectTags(content.tags),
    metadata: Object.keys(metadata).length ? metadata : undefined,
  }

  if (messageType === 'insight_spotlight') {
    const payload = toInsightPayload(item, content, metadata)
    const actions = resolveActions(metadata, 'scale')
    return {
      ...base,
      type: 'insight_spotlight',
      actions,
      payload,
    }
  }

  if (messageType === 'nudge') {
    const payload: NudgeMessage = toNudgePayload(content, metadata)
    const actions = resolveActions(metadata, 'scale')
    return {
      ...base,
      type: 'nudge',
      actions,
      payload,
    }
  }

  if (messageType === 'notification') {
    const payload: NotificationMessage = toNotificationPayload(content, metadata)
    const actions = resolveActions(metadata, 'acknowledge')
    return {
      ...base,
      type: 'notification',
      actions,
      payload,
    }
  }

  // Unified inbox types
  if (messageType === 'observation') {
    const payload = toObservationPayload(content, metadata)
    const actions = resolveActions(metadata, 'scale')
    return {
      ...base,
      type: 'observation',
      actions,
      payload,
    }
  }

  if (messageType === 'question') {
    const payload = toQuestionPayload(content, metadata)
    const actions = resolveActions(metadata, 'scale')
    return {
      ...base,
      type: 'question',
      actions,
      payload,
    }
  }

  if (messageType === 'pattern') {
    const payload = toPatternPayload(content, metadata)
    const actions = resolveActions(metadata, 'scale')
    return {
      ...base,
      type: 'pattern',
      actions,
      payload,
    }
  }

  if (messageType === 'session_summary') {
    const payload = toSessionSummaryPayload(content, metadata)
    const actions = resolveActions(metadata, 'acknowledge')
    return {
      ...base,
      type: 'session_summary',
      actions,
      payload,
    }
  }

  if (messageType === 'follow_up') {
    const payload = toFollowUpPayload(content, metadata)
    const actions = resolveActions(metadata, 'scale')
    return {
      ...base,
      type: 'follow_up',
      actions,
      payload,
    }
  }

  return null
}

export async function getInboxItemById(
  supabase: SupabaseClient<Database>,
  id: string,
  userId: string
): Promise<InboxItem | null> {
  const { data, error } = await supabase
    .from('inbox_items_view')
    .select('*')
    .eq('source_id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  return mapInboxRowToItem(data as InboxItemRow)
}
