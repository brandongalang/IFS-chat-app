import assert from 'node:assert/strict'

import { getInboxQueueSnapshot, getRecentObservationHistory } from '@/lib/data/inbox-queue'

function createSupabaseStub(options: { count?: number; historyRows?: any[] }) {
  const { count = 0, historyRows = [] } = options

  return {
    from(table: string) {
      if (table === 'inbox_items_view') {
        return {
          select() {
            return this
          },
          eq() {
            return this
          },
          in() {
            return Promise.resolve({ count, error: null })
          },
        }
      }

      if (table === 'inbox_observations') {
        return {
          select() {
            return this
          },
          eq() {
            return this
          },
          gte() {
            return this
          },
          order() {
            return this
          },
          limit() {
            return Promise.resolve({ data: historyRows, error: null })
          },
        }
      }

      throw new Error(`Unexpected table requested in stub: ${table}`)
    },
  }
}

async function testQueueSnapshot() {
  const supabase = createSupabaseStub({ count: 2 })
  const snapshot = await getInboxQueueSnapshot(supabase as any, 'user-123')

  assert.equal(snapshot.total, 2)
  assert.equal(snapshot.limit, 3)
  assert.equal(snapshot.available, 1)
  assert.equal(snapshot.hasCapacity, true)
}

async function testObservationHistory() {
  const now = new Date().toISOString()
  const rows = [
    {
      id: 'obs-1',
      user_id: 'user-123',
      status: 'pending',
      semantic_hash: 'hash-1',
      created_at: now,
      content: { title: 'Sample observation' },
      metadata: { insight_type: 'observation' },
      timeframe_start: null,
      timeframe_end: null,
      confidence: 0.8,
    },
  ]

  const supabase = createSupabaseStub({ historyRows: rows })
  const history = await getRecentObservationHistory(supabase as any, 'user-123', { lookbackDays: 7 })

  assert.equal(history.length, 1)
  assert.equal(history[0]?.semanticHash, 'hash-1')
  assert.equal(history[0]?.content.title, 'Sample observation')
}

async function main() {
  await testQueueSnapshot()
  await testObservationHistory()
}

void main()
