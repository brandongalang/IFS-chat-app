import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isInboxEnabled } from '@/config/features'
import { normalizeInboxResponse } from '@/lib/inbox/normalize'
import { getPragmaticInboxFeed } from '@/lib/inbox/pragmaticData'

interface SupabaseInboxPayload {
  headline?: string | null
  summary?: string | null
  detail?: Record<string, unknown> | null
  cta?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

interface SupabaseInboxRow {
  id: string
  type: string
  priority: number | null
  tags: string[] | null
  created_at: string
  updated_at: string | null
  expires_at: string | null
  inbox_message_payloads: SupabaseInboxPayload | SupabaseInboxPayload[] | null
}

export async function GET(_req: NextRequest) {
  if (!isInboxEnabled()) {
    return NextResponse.json({ data: [], message: 'Inbox is disabled' }, { status: 404 })
  }

  const fallback = normalizeInboxResponse(getPragmaticInboxFeed())

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        {
          data: fallback,
          source: 'fallback',
          variant: 'pragmatic',
          reason: 'unauthenticated',
          generatedAt: new Date().toISOString(),
        },
        { status: 200 },
      )
    }

    const { data, error } = await supabase
      .from('inbox_message_subjects')
      .select(
        `id, type, priority, tags, created_at, updated_at, expires_at,
         inbox_message_payloads (headline, summary, detail, cta, metadata)`,
      )
      .eq('user_id', user.id)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('[api/inbox] supabase error', error)
      return NextResponse.json(
        {
          data: fallback,
          source: 'fallback',
          variant: 'pragmatic',
          reason: 'supabase_error',
          generatedAt: new Date().toISOString(),
        },
        { status: 200 },
      )
    }

    const rows = Array.isArray(data) ? data : []
    const raw = rows.map((row) => mapSupabaseRow(row))
    const normalized = normalizeInboxResponse(raw)
    const payload = normalized.length ? normalized : fallback
    const source = normalized.length ? 'supabase' : 'fallback'

    return NextResponse.json(
      {
        data: payload,
        source,
        variant: 'pragmatic',
        generatedAt: new Date().toISOString(),
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('[api/inbox] unexpected error', error)
    return NextResponse.json(
      {
        data: fallback,
        source: 'fallback',
        variant: 'pragmatic',
        reason: 'unexpected_error',
        generatedAt: new Date().toISOString(),
      },
      { status: 200 },
    )
  }
}

function mapSupabaseRow(row: SupabaseInboxRow) {
  const payloadCandidate = Array.isArray(row.inbox_message_payloads)
    ? row.inbox_message_payloads[0]
    : row.inbox_message_payloads
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
    actions: {
      kind: 'boolean' as const,
      positiveLabel: 'This resonates',
      negativeLabel: 'Not right now',
      allowNotes: true,
    },
    metadata: payloadCandidate?.metadata ?? undefined,
  }

  switch (row.type) {
    case 'insight_spotlight':
      return {
        ...base,
        payload: {
          insightId: getMetadataString(payloadCandidate?.metadata, 'insight_id') ?? row.id,
          title: stringOrNull(payloadCandidate?.headline) ?? 'Insight spotlight',
          summary:
            stringOrNull(payloadCandidate?.summary) ?? 'Tap to open the latest insight.',
          prompt: getMetadataString(payloadCandidate?.metadata, 'prompt') ?? undefined,
          readingTimeMinutes: getMetadataNumber(payloadCandidate?.metadata, 'reading_time_minutes'),
          detail:
            payloadCandidate?.detail && typeof payloadCandidate.detail === 'object'
              ? (payloadCandidate.detail as Record<string, unknown>)
              : undefined,
          cta: coerceCta(payloadCandidate?.cta) ?? undefined,
        },
      }
    case 'nudge':
      return {
        ...base,
        payload: {
          headline: stringOrNull(payloadCandidate?.headline) ?? 'Reminder',
          body: stringOrNull(payloadCandidate?.summary) ?? 'Check in with yourself today.',
          cta: coerceCta(payloadCandidate?.cta) ?? undefined,
        },
      }
    case 'cta':
      return {
        ...base,
        payload: {
          title: stringOrNull(payloadCandidate?.headline) ?? 'Action needed',
          description: stringOrNull(payloadCandidate?.summary) ?? 'Complete the suggested action.',
          action:
            coerceCta(payloadCandidate?.cta) ?? {
              label: 'Open',
              href: '/',
            },
        },
      }
    case 'notification':
      return {
        ...base,
        payload: {
          title: stringOrNull(payloadCandidate?.headline) ?? 'Notification',
          body: stringOrNull(payloadCandidate?.summary) ?? '',
          unread: true,
        },
      }
    default:
      return {
        ...base,
        payload: payloadCandidate ?? {},
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
    analyticsTag: stringOrNull(value.analyticsTag) ?? undefined,
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
  return stringOrNull(metadata[key])
}

function getMetadataNumber(metadata: Record<string, unknown> | null | undefined, key: string) {
  if (!metadata) return undefined
  const value = metadata[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return undefined
}
