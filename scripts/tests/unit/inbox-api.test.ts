import { strict as assert } from 'node:assert'
import { NextRequest } from 'next/server'
import { setServerClientOverrideForTests } from '@/lib/supabase/server'

process.env.NODE_ENV = 'test'
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabase.local'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'anon-key'

const mockRows = [
  {
    id: 'revealed-insight',
    user_id: 'test-user',
    source_type: 'insight',
    status: 'revealed',
    part_id: 'part-1',
    content: { title: 'Revealed Insight' },
    metadata: null,
    created_at: '2025-09-20T12:00:00.000Z',
  },
  {
    id: 'pending-insight',
    user_id: 'test-user',
    source_type: 'insight',
    status: 'pending',
    part_id: 'part-2',
    content: { title: 'Pending Insight' },
    metadata: null,
    created_at: '2025-09-20T13:00:00.000Z',
  },
  {
    id: 'follow-up',
    user_id: 'test-user',
    source_type: 'follow_up',
    status: 'new',
    part_id: 'part-3',
    content: { title: 'Follow Up' },
    metadata: null,
    created_at: '2025-09-19T09:00:00.000Z',
  },
]

const serverClient = {
  auth: {
    async getUser() {
      return { data: { user: { id: 'test-user' } } }
    },
  },
  from(table: string) {
    assert.equal(table, 'inbox_items_view', 'expected inbox_items_view query')
    const builder: any = {
      select() {
        return builder
      },
      eq(column: string, value: unknown) {
        assert.equal(column, 'user_id')
        assert.equal(value, 'test-user')
        return builder
      },
      limit(limit: number) {
        assert(limit >= 2)
        return Promise.resolve({ data: mockRows, error: null })
      },
    }

    return builder
  },
}

setServerClientOverrideForTests(serverClient as any)

async function main() {
  const { GET } = await import('@/app/api/inbox/route')

  const request = new NextRequest('http://localhost/api/inbox?limit=2')
  const response = await GET(request)

  assert.equal(response.status, 200, 'expected success status')

  const body = (await response.json()) as any
  assert.equal(body.items.length, 2, 'should return requested limit of items')
  assert.deepEqual(
    body.items.map((item: any) => item.id),
    ['revealed-insight', 'pending-insight'],
    'items should be ranked by priority order',
  )
  assert.equal(body.items[0].content.title, 'Revealed Insight')
  assert.ok(body.nextCursor, 'expected next cursor to be present')

  console.log('Inbox GET endpoint unit test passed.')
}

main()
  .catch((error) => {
    console.error('Inbox GET endpoint unit test failed:', error)
    process.exitCode = 1
  })
  .finally(() => {
    setServerClientOverrideForTests(null)
  })
