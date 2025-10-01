import assert from 'node:assert/strict'

async function main() {
  const modulePath = '@/lib/data/inbox-items?test=' + Date.now()
  const { mapInboxItemToEnvelope } = await import(modulePath)

  const envelope = mapInboxItemToEnvelope({
    id: 'insight-123',
    userId: 'user-1',
    sourceType: 'insight',
    status: 'pending',
    partId: null,
    createdAt: new Date('2025-10-01T10:00:00Z').toISOString(),
    content: {
      title: 'Evening journaling lowers reactivity',
      body: 'Sessions after journaling show 25% fewer escalations.',
    },
    metadata: {
      insight_type: 'observation',
    },
  })

  assert(envelope, 'Expected envelope to be generated from inbox item')
  assert(envelope?.type === 'insight_spotlight', 'Expected insight items to map to insight_spotlight')
  assert(envelope?.actions?.kind === 'scale4', 'Expected scale4 actions for insights')
  assert(envelope?.payload.title?.length, 'Expected payload title to exist')

  console.log('Inbox mapper test passed.')
}

void main()
