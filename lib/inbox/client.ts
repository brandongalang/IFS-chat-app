import { normalizeInboxResponse } from '@/lib/inbox/normalize'
import type {
  InboxActionRequest,
  InboxEnvelope,
  InboxEnvelopeSource,
  InboxFeedResponse,
  InboxFeedResult,
  InboxFeedVariant,
} from '@/types/inbox'

const ENDPOINT_BY_VARIANT: Record<InboxFeedVariant, string> = {
  pragmatic: '/api/inbox',
  clean: '/api/inbox/clean',
}

const ALLOWED_SOURCES: InboxEnvelopeSource[] = ['network', 'fallback', 'supabase', 'edge']
const ALLOWED_VARIANTS: InboxFeedVariant[] = ['pragmatic', 'clean']

const coerceSource = (
  value: unknown,
  fallback: InboxEnvelopeSource | 'fallback',
): InboxEnvelopeSource | 'fallback' => {
  if (typeof value !== 'string') return fallback
  return ALLOWED_SOURCES.includes(value as InboxEnvelopeSource)
    ? (value as InboxEnvelopeSource)
    : fallback
}

const coerceVariant = (value: unknown, fallback: InboxFeedVariant): InboxFeedVariant => {
  if (typeof value !== 'string') return fallback
  return ALLOWED_VARIANTS.includes(value as InboxFeedVariant)
    ? (value as InboxFeedVariant)
    : fallback
}

type FetchOptions = {
  signal?: AbortSignal
}

export async function fetchInboxFeed(
  variant: InboxFeedVariant = 'pragmatic',
  options: FetchOptions = {},
): Promise<InboxFeedResult> {
  const endpoint = ENDPOINT_BY_VARIANT[variant] ?? ENDPOINT_BY_VARIANT.pragmatic
  const response = await fetch(endpoint, {
    method: 'GET',
    signal: options.signal,
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch inbox feed (${response.status})`)
  }

  const body: InboxFeedResponse | InboxEnvelope[] = await response.json()

  const payload = Array.isArray(body) ? body : body.data
  let resolvedVariant: InboxFeedVariant = variant
  let resolvedSource: InboxEnvelopeSource | 'fallback' = 'network'
  let generatedAt: string | undefined
  let reason: string | undefined

  if (!Array.isArray(body)) {
    resolvedVariant = coerceVariant(body.variant, variant)
    resolvedSource = coerceSource(body.source, 'network')
    generatedAt = typeof body.generatedAt === 'string' ? body.generatedAt : undefined
    reason = typeof body.reason === 'string' ? body.reason : undefined
  }

  const envelopes = normalizeInboxResponse(payload)

  return {
    envelopes,
    variant: resolvedVariant,
    source: resolvedSource,
    generatedAt,
    reason,
  }
}

export async function submitInboxEvent(request: InboxActionRequest): Promise<void> {
  const response = await fetch('/api/inbox/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`Failed to submit inbox event (${response.status})`)
  }
}
