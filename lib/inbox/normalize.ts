import type {
  InboxEnvelope,
  InboxEnvelopeSource,
  InboxEnvelopeBase,
  InboxMessageType,
  InsightSpotlightMessage,
  CallToActionMessage,
  InboxCTA,
  NudgeMessage,
  NotificationMessage,
  InboxActionSchema,
} from '@/types/inbox'

const allowedTypes: InboxMessageType[] = [
  'insight_spotlight',
  'nudge',
  'cta',
  'notification',
]

const allowedSources: InboxEnvelopeSource[] = ['network', 'fallback', 'supabase', 'edge']

export function normalizeInboxResponse(input: unknown): InboxEnvelope[] {
  if (!Array.isArray(input)) return []
  const items: InboxEnvelope[] = []
  for (const candidate of input) {
    const envelope = coerceInboxEnvelope(candidate)
    if (envelope) items.push(envelope)
  }
  return items
}

export function coerceInboxEnvelope(candidate: unknown): InboxEnvelope | null {
  if (!isRecord(candidate)) return null

  const type = safeString(candidate.type)
  if (!type || !allowedTypes.includes(type as InboxMessageType)) return null

  const createdAt = coerceDate(candidate.createdAt)
  const updatedAt = optionalDate(candidate.updatedAt)
  const expiresAt = optionalDate(candidate.expiresAt)
  const readAt = optionalDate(candidate.readAt)
  const priority = typeof candidate.priority === 'number' ? candidate.priority : undefined
  const tags = Array.isArray(candidate.tags)
    ? candidate.tags.filter((tag): tag is string => typeof tag === 'string')
    : undefined

  const sourceRaw = safeString(candidate.source)
  const source: InboxEnvelopeSource = sourceRaw && allowedSources.includes(sourceRaw as InboxEnvelopeSource)
    ? (sourceRaw as InboxEnvelopeSource)
    : 'network'

  const actions = coerceActions(candidate.actions)
  const metadata = isRecord(candidate.metadata) ? candidate.metadata : undefined

  const base: InboxEnvelopeBase = {
    id: safeString(candidate.id) || `inbox-${type}-${createdAt}`,
    type: type as InboxMessageType,
    createdAt,
    updatedAt: updatedAt ?? null,
    expiresAt: expiresAt ?? null,
    readAt: readAt ?? null,
    source,
    priority,
    tags,
    actions,
    metadata,
  }

  const payloadCandidate = candidate.payload
  switch (type) {
    case 'insight_spotlight': {
      const payload = coerceInsightSpotlightPayload(payloadCandidate)
      if (!payload) return null
      return { ...base, type: 'insight_spotlight', payload }
    }
    case 'nudge': {
      const payload = coerceNudgePayload(payloadCandidate)
      if (!payload) return null
      return { ...base, type: 'nudge', payload }
    }
    case 'cta': {
      const payload = coerceCtaPayload(payloadCandidate)
      if (!payload) return null
      return { ...base, type: 'cta', payload }
    }
    case 'notification': {
      const payload = coerceNotificationPayload(payloadCandidate)
      if (!payload) return null
      return { ...base, type: 'notification', payload }
    }
    default:
      return null
  }
}

function coerceInsightSpotlightPayload(candidate: unknown): InsightSpotlightMessage | null {
  if (!isRecord(candidate)) return null
  const insightId = safeString(candidate.insightId)
  const title = safeString(candidate.title)
  const summary = safeString(candidate.summary)
  if (!insightId || !title || !summary) return null

  const readingTimeMinutes = typeof candidate.readingTimeMinutes === 'number' && candidate.readingTimeMinutes >= 0
    ? Math.round(candidate.readingTimeMinutes)
    : undefined
  const prompt = safeString(candidate.prompt)

  const detailCandidate = isRecord(candidate.detail)
    ? {
        body: safeString(candidate.detail.body) ?? '',
        sources: Array.isArray(candidate.detail.sources)
          ? candidate.detail.sources
              .map((entry) => {
                if (!isRecord(entry)) return null
                const label = safeString(entry.label)
                const url = safeString(entry.url)
                if (!label || !url) return null
                return { label, url }
              })
              .filter((entry): entry is { label: string; url: string } => Boolean(entry))
          : undefined,
      }
    : undefined

  const cta = coerceInboxCta(candidate.cta)

  return {
    insightId,
    title,
    summary,
    prompt: prompt ?? undefined,
    readingTimeMinutes,
    detail: detailCandidate?.body ? detailCandidate : undefined,
    cta: cta ?? undefined,
  }
}

function coerceNudgePayload(candidate: unknown): NudgeMessage | null {
  if (!isRecord(candidate)) return null
  const headline = safeString(candidate.headline)
  const body = safeString(candidate.body)
  if (!headline || !body) return null
  const cta = coerceInboxCta(candidate.cta)
  return {
    headline,
    body,
    cta: cta ?? undefined,
  }
}

function coerceCtaPayload(candidate: unknown): CallToActionMessage | null {
  if (!isRecord(candidate)) return null
  const title = safeString(candidate.title)
  const description = safeString(candidate.description)
  const action = coerceInboxCta(candidate.action)
  if (!title || !description || !action) return null
  return {
    title,
    description,
    action,
  }
}

function coerceNotificationPayload(candidate: unknown): NotificationMessage | null {
  if (!isRecord(candidate)) return null
  const title = safeString(candidate.title)
  const body = safeString(candidate.body)
  if (!title || !body) return null
  const unread = typeof candidate.unread === 'boolean' ? candidate.unread : false
  const link = isRecord(candidate.link)
    ? {
        label: safeString(candidate.link.label) ?? '',
        href: safeString(candidate.link.href) ?? '#',
        target: safeString(candidate.link.target) as '_blank' | '_self' | undefined,
        analyticsTag: safeString(candidate.link.analyticsTag) ?? undefined,
      }
    : undefined
  return {
    title,
    body,
    unread,
    link: link?.label && link?.href ? link : undefined,
  }
}

function coerceActions(candidate: unknown): InboxActionSchema | undefined {
  if (!isRecord(candidate)) return undefined
  const kind = safeString(candidate.kind)
  if (kind === 'boolean') {
    return {
      kind: 'boolean',
      positiveLabel: safeString(candidate.positiveLabel) ?? undefined,
      negativeLabel: safeString(candidate.negativeLabel) ?? undefined,
      allowNotes: typeof candidate.allowNotes === 'boolean' ? candidate.allowNotes : undefined,
    }
  }
  return undefined
}

function coerceInboxCta(candidate: unknown): InboxCTA | null {
  if (!isRecord(candidate)) return null
  const label = safeString(candidate.label)
  if (!label) return null
  const href = safeString(candidate.href) ?? undefined
  const actionId = safeString(candidate.actionId) ?? undefined
  const intent = safeString(candidate.intent)
  const helperText = safeString(candidate.helperText) ?? undefined
  return {
    label,
    href,
    actionId,
    intent: intent === 'secondary' ? 'secondary' : 'primary',
    helperText,
  }
}

function coerceDate(value: unknown): string {
  const candidate = safeString(value)
  const date = candidate ? new Date(candidate) : new Date()
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString()
  }
  return date.toISOString()
}

function optionalDate(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const coerced = coerceDate(value)
  return coerced
}

function safeString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
