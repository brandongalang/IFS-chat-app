import { strict as assert } from 'assert'

async function main() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.com'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon_key_12345678901234567890'

  const events = [
    { event_id: 'ev1', ts: '2024-01-01T00:00:00Z', rationale: 'test action 1' },
    { event_id: 'ev2', ts: '2024-01-02T00:00:00Z', rationale: 'test action 2' }
  ]
  let fromTable = ''
  const supabase = {
    from(table: string) {
      fromTable = table
      const query: any = {
        select() { return query },
        eq() { return query },
        gte() { return query },
        order() { return query },
        limit() { return Promise.resolve({ data: events, error: null }) }
      }
      return query
    }
  }

  const { getRecentActions } = await import('../../../mastra/tools/rollback-tools')
  const result = await getRecentActions(
    supabase as any,
    { userId: '00000000-0000-0000-0000-000000000000', limit: 5, withinMinutes: 60 }
  )

  assert(result.success, 'expected success')
  assert.equal(fromTable, 'events')
  assert.equal(result.data.length, 2)
  assert.equal(result.data[0].summary, 'test action 1')

  console.log('Rollback event ledger unit test passed.')
}

main().catch(err => {
  console.error('Rollback event ledger unit test failed:', err)
  process.exit(1)
})
