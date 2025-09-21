import { normalizeInboxResponse } from '@/lib/inbox/normalize'
import type {
  InboxActionRequest,
  InboxEnvelope,
  InboxFeedResponse,
  InboxFeedVariant,
} from '@/types/inbox'

const ENDPOINT_BY_VARIANT: Record<InboxFeedVariant, string> = {
  pragmatic: '/api/inbox',
  clean: '/api/inbox/clean',
}

type FetchOptions = {
  signal?: AbortSignal
}

export async function fetchInboxFeed(
  variant: InboxFeedVariant = 'pragmatic',
  options: FetchOptions = {},
): Promise<InboxEnvelope[]> {
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
  return normalizeInboxResponse(payload)
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
