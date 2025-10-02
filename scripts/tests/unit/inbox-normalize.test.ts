import type { InboxEnvelope, InsightSpotlightEnvelope } from '@/types/inbox'

export {}

async function main() {
  const modulePath = '@/lib/inbox/normalize?test=' + Date.now()
  const { normalizeInboxResponse, coerceInboxEnvelope } =
    (await import(modulePath)) as typeof import('@/lib/inbox/normalize')

  const validPayload = {
    id: 'test-1',
    type: 'insight_spotlight',
    createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    source: 'network',
    payload: {
      insightId: 'insight-123',
      title: 'A clear pattern emerges',
      summary: 'You respond best after breathing exercises.',
      readingTimeMinutes: 2,
      detail: {
        body: 'Breathing exercises before check-ins appear to reduce reactivity.',
        sources: [{ label: 'Breath log', url: '/breath' }],
      },
      cta: {
        label: 'See insight',
        href: '/insights/insight-123',
      },
    },
  }

  const result = normalizeInboxResponse([validPayload])
  assert(result.length === 1, 'Expected valid payload to pass normalization')
  const spotlight = result[0]
  assertIsInsightSpotlight(spotlight, 'Expected normalized payload to remain an insight spotlight message')
  assert(spotlight.payload.detail?.sources?.[0]?.label === 'Breath log', 'Expected sources to remain intact')

  const invalidPayload = {
    id: 'invalid',
    type: 'unknown',
    createdAt: 'not-a-date',
    payload: {},
  }

  const mixed = normalizeInboxResponse([validPayload, invalidPayload])
  assert(mixed.length === 1, 'Invalid payload should be filtered out')

  const coerced = coerceInboxEnvelope({
    id: 'coerced-1',
    type: 'cta',
    payload: {
      title: 'Complete onboarding',
      description: 'Finish your onboarding flow to unlock insights.',
      action: {
        label: 'Finish onboarding',
        href: '/onboarding',
      },
    },
  })
  assert(coerced !== null, 'Coercion should bridge missing optional fields')
  assert(coerced?.createdAt, 'Coerced envelope should have a createdAt value')

  console.log('Inbox normalization tests passed.')
}

function assertIsInsightSpotlight(
  envelope: InboxEnvelope | undefined,
  message: string,
): asserts envelope is InsightSpotlightEnvelope {
  if (!envelope || envelope.type !== 'insight_spotlight') {
    throw new Error(message)
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

main().catch((error) => {
  console.error('Inbox normalization tests failed:', error)
  process.exit(1)
})
