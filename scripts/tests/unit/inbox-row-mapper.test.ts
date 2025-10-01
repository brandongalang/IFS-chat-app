import assert from 'node:assert/strict'

async function main() {
  const modulePath = '@/lib/data/inbox-items?test=' + Date.now()
  const { mapInboxRowToItem } = await import(modulePath)

  const createdAt = new Date('2025-10-01T12:00:00Z').toISOString()

  const row = {
    user_id: 'user-123',
    source_type: 'insight',
    status: 'pending',
    part_id: null,
    content: {
      title: 'Sample insight',
    },
    metadata: {
      insight_type: 'observation',
    },
    source_id: 'insight-uuid-123',
    created_at: createdAt,
  }

  const result = mapInboxRowToItem(row)

  assert.equal(result.id, 'insight-uuid-123', 'Expected id to map from source_id')
  assert.equal(result.sourceId, 'insight-uuid-123', 'Expected sourceId to map from source_id')
  assert.equal(result.createdAt, createdAt, 'Expected createdAt passthrough')
}

void main()
