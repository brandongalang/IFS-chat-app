import type { InboxEnvelope } from '@/types/inbox'
import { normalizeInboxResponse } from '@/lib/inbox/normalize'
import { createSupabaseClient } from './supabaseClient'

interface HandlerOptions {
  userId: string
  limit?: number
}

type InboxPayloadRow = {
  headline?: string | null
  summary?: string | null
  detail?: Record<string, unknown> | null
  cta?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

type InboxSubjectRow = {
  id: string
  type: InboxEnvelope['type']
  priority: number | null
  tags: string[] | null
  created_at: string
  updated_at: string | null
  expires_at: string | null
  payload: InboxPayloadRow | InboxPayloadRow[] | null
}

export async function fetchInboxFeed({ userId, limit = 3 }: HandlerOptions): Promise<InboxEnvelope[]> {
  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('inbox_message_subjects')
    .select(
      `id, type, priority, tags, created_at, updated_at, expires_at,
       payload:inbox_message_payloads(headline, summary, detail, cta, metadata)`
    )
    .eq('user_id', userId)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  const rows = (data as InboxSubjectRow[]) || []
  const raw = rows.map((row) => toRawEnvelope(row))
  return normalizeInboxResponse(raw)
}

export async function logInboxReaction({
  userId,
  subjectId,
  eventType,
  metadata,
}: {
  userId: string
  subjectId: string
  eventType: 'opened' | 'dismissed' | 'cta_clicked'
  metadata?: Record<string, unknown>
}) {
  const supabase = createSupabaseClient()
  const { error } = await supabase.from('inbox_message_events').insert({
    subject_id: subjectId,
    user_id: userId,
    event_type: eventType,
    attributes: metadata ?? {},
  })
  if (error) throw error
}

function toRawEnvelope(row: InboxSubjectRow) {
  const payload = Array.isArray(row.payload) ? row.payload[0] : row.payload
  const base = {
    id: row.id,
    type: row.type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
    readAt: null,
    source: 'supabase' as const,
    priority: row.priority ?? undefined,
    tags: row.tags ?? undefined,
  }

  switch (row.type) {
    case 'insight_spotlight':
      return {
        ...base,
        payload: {
          insightId: getMetadataString(payload?.metadata, 'insight_id') ?? row.id,
          title: stringOrNull(payload?.headline) ?? stringOrNull(payload?.summary) ?? 'Insight spotlight',
          summary: stringOrNull(payload?.summary) ?? stringOrNull(payload?.headline) ?? 'Tap to open insight detail',
          prompt: getMetadataString(payload?.metadata, 'prompt') ?? undefined,
          detail: payload?.detail && typeof payload.detail === 'object' ? payload.detail : undefined,
          cta: coerceCta(payload?.cta),
        },
      }
    case 'nudge':
      return {
        ...base,
        payload: {
          headline: stringOrNull(payload?.headline) ?? 'Reminder',
          body: stringOrNull(payload?.summary) ?? 'Check in with yourself today.',
          cta: coerceCta(payload?.cta) ?? undefined,
        },
      }
    case 'cta':
      return {
        ...base,
        payload: {
          title: stringOrNull(payload?.headline) ?? 'Action needed',
          description: stringOrNull(payload?.summary) ?? 'Complete the suggested action.',
          action:
            coerceCta(payload?.cta) ?? {
              label: 'Open',
              href: '/',
            },
        },
      }
    case 'notification':
      return {
        ...base,
        payload: {
          title: stringOrNull(payload?.headline) ?? 'Notification',
          body: stringOrNull(payload?.summary) ?? '',
          unread: true,
        },
      }
    default:
      return {
        ...base,
        payload: payload ?? {},
      }
  }
}

function coerceCta(value: Record<string, unknown> | null | undefined) {
  if (!value) return undefined
  const label = stringOrNull(value.label)
  if (!label) return undefined
  return {
    label,
    href: stringOrNull(value.href) ?? undefined,
    actionId: stringOrNull(value.actionId) ?? undefined,
    intent: stringOrNull(value.intent) === 'secondary' ? 'secondary' : 'primary',
    helperText: stringOrNull(value.helperText) ?? undefined,
    target: stringOrNull(value.target) === '_blank' ? '_blank' : undefined,
  }
}

function stringOrNull(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
  }
  return null
}

function getMetadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  if (!metadata) return null
  const value = metadata[key]
  return stringOrNull(value)
}
