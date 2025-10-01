import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  InboxActionSchema,
  InboxContent,
  InboxCTA,
  InboxEnvelope,
  InboxEnvelopeSource,
  InboxItem,
  InboxMessageType,
  NudgeMessage,
  NotificationMessage,
  InsightSpotlightMessage,
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

const toString = (value: unknown): string | undefined => {
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
  const raw = toString(value)
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
  const helperText = toString(metadata.action_helper_text)
  const allowNotes = toBoolean(metadata.allow_notes)
  return {
    kind: 'scale4',
    agreeStrongLabel: toString(labels.agreeStrong) ?? toString(labels.agree_strong) ?? DEFAULT_SCALE_LABELS.agreeStrong,
    agreeLabel: toString(labels.agree) ?? DEFAULT_SCALE_LABELS.agree,
    disagreeLabel: toString(labels.disagree) ?? DEFAULT_SCALE_LABELS.disagree,
    disagreeStrongLabel:
      toString(labels.disagreeStrong) ?? toString(labels.disagree_strong) ?? DEFAULT_SCALE_LABELS.disagreeStrong,
    helperText: helperText ?? undefined,
    allowNotes: allowNotes ?? true,
  }
}

const buildAcknowledgeActions = (metadata: MetadataRecord): InboxActionSchema => {
  const label = toString(metadata.ack_label)
  const helperText = toString(metadata.action_helper_text)
  const allowNotes = toBoolean(metadata.allow_notes)
  return {
    kind: 'acknowledge',
    label: label ?? DEFAULT_ACK_LABEL,
    helperText: helperText ?? undefined,
    allowNotes: allowNotes ?? true,
  }
}

const resolveEnvelopeType = (item: InboxItem, metadata: MetadataRecord): InboxMessageType => {
  const sourceType = item.sourceType
  const metaKind = toString(metadata.kind)
  const insightType = toString(metadata.insight_type)

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
  const title = toString(content.title) ?? 'Insight update'
  const summary = toString(content.summary) ?? toString(content.body) ?? 'Open to explore this insight.'
  const prompt = toString(content.prompt) ?? toString(metadata.prompt)
  const detailBody = toString(content.body) ?? undefined
  const sourcesRaw = Array.isArray(content.sources) ? content.sources : metadata.sources
  const sources = Array.isArray(sourcesRaw)
    ? sourcesRaw
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null
          const record = entry as MetadataRecord
          const label = toString(record.label)
          const url = toString(record.url)
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
  const headline = toString(content.title) ?? toString(content.headline) ?? 'Gentle reminder'
  const body = toString(content.body) ?? toString(metadata.body) ?? 'Take a quick action that supports your practice.'
  const cta = normalizeCta(content.cta ?? metadata.cta)
  return {
    headline,
    body,
    cta: cta ?? undefined,
  }
}

const toNotificationPayload = (content: MetadataRecord, metadata: MetadataRecord): NotificationMessage => {
  const title = toString(content.title) ?? toString(metadata.title) ?? 'Update'
  const body = toString(content.body) ?? toString(metadata.body) ?? 'There is something new to review.'
  const unread = toBoolean(metadata.unread) ?? true
  const linkRecord = toRecord(content.link ?? metadata.link)
  const linkLabel = toString(linkRecord.label)
  const linkHref = toString(linkRecord.href)
  const linkTarget = toString(linkRecord.target)
  const analyticsTag = toString(linkRecord.analyticsTag)
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

const normalizeCta = (candidate: unknown): InboxCTA | null => {
  if (!candidate || typeof candidate !== 'object') return null
  const record = candidate as MetadataRecord
  const label = toString(record.label)
  if (!label) return null
  const href = toString(record.href)
  const actionId = toString(record.actionId)
  const intent = toString(record.intent)
  const helperText = toString(record.helperText)
  const targetRaw = toString(record.target)
  const analyticsTag = toString(record.analyticsTag)
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
    const actions: InboxActionSchema = buildScaleActions(metadata)
    return {
      ...base,
      type: 'insight_spotlight',
      actions,
      payload,
    }
  }

  if (messageType === 'nudge') {
    const payload: NudgeMessage = toNudgePayload(content, metadata)
    const actions: InboxActionSchema = buildScaleActions(metadata)
    return {
      ...base,
      type: 'nudge',
      actions,
      payload,
    }
  }

  if (messageType === 'notification') {
    const payload: NotificationMessage = toNotificationPayload(content, metadata)
    const actions: InboxActionSchema = buildAcknowledgeActions(metadata)
    return {
      ...base,
      type: 'notification',
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
