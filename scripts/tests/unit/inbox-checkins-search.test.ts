import assert from 'node:assert/strict'

import type { SupabaseDatabaseClient } from '@/lib/supabase/clients'

type QueryOperator = 'eq' | 'gte'

type QueryRequest = {
  table: string
  select?: string
  filters: Array<{ op: QueryOperator; column: string; value: unknown }>
  order?: { column: string; ascending: boolean }
  limit?: number
}

type QueryResponse<T> = { data: T | null; error: { message: string } | null }

type QueryHandler<T> = (request: QueryRequest) => QueryResponse<T>

function createStubClient<T>(handler: QueryHandler<T>): SupabaseDatabaseClient {
  class StubQuery {
    private request: QueryRequest
    private result: QueryResponse<T> | null = null

    constructor(private readonly table: string) {
      this.request = { table, filters: [] }
    }

    select(columns: string) {
      this.request.select = columns
      return this
    }

    eq(column: string, value: unknown) {
      this.request.filters.push({ op: 'eq', column, value })
      return this
    }

    gte(column: string, value: unknown) {
      this.request.filters.push({ op: 'gte', column, value })
      return this
    }

    order(column: string, options?: { ascending?: boolean }) {
      this.request.order = { column, ascending: options?.ascending ?? true }
      return this
    }

    limit(value: number) {
      this.request.limit = value
      return this
    }

    maybeSingle() {
      const response = this.ensureResult()
      const data = Array.isArray(response.data) ? (response.data as unknown[])[0] ?? null : response.data
      return Promise.resolve({ data, error: response.error })
    }

    then<TResult1 = QueryResponse<T>, TResult2 = never>(
      onfulfilled?: ((value: QueryResponse<T>) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
      return Promise.resolve(this.ensureResult()).then(onfulfilled, onrejected)
    }

    private ensureResult(): QueryResponse<T> {
      if (!this.result) {
        const snapshot: QueryRequest = {
          table: this.request.table,
          select: this.request.select,
          filters: [...this.request.filters],
          order: this.request.order ? { ...this.request.order } : undefined,
          limit: this.request.limit,
        }
        this.result = handler(snapshot) ?? { data: null, error: null }
      }
      return this.result
    }
  }

  return {
    from(table: string) {
      return new StubQuery(table) as unknown
    },
  } as SupabaseDatabaseClient
}

type CheckInRow = {
  id: string
  user_id: string
  type: string
  check_in_date: string
  intention: string | null
  reflection: string | null
  gratitude: string | null
  parts_data: unknown
  created_at: string
  updated_at: string
}

async function main() {
  const checkInA: CheckInRow = {
    id: 'check-1',
    user_id: 'user-1',
    type: 'morning',
    check_in_date: '2024-09-30',
    intention: 'Set a calm tone for the day.',
    reflection: 'I felt gratitude during meditation.',
    gratitude: 'Thankful for deep breaths.',
    parts_data: { morning: { focus: 'breathing' } },
    created_at: '2024-09-30T12:00:00Z',
    updated_at: '2024-09-30T12:00:00Z',
  }

  const checkInB: CheckInRow = {
    id: 'check-2',
    user_id: 'user-1',
    type: 'evening',
    check_in_date: '2024-09-29',
    intention: 'Reflect on evening calm.',
    reflection: 'Evening walk reduced tension.',
    gratitude: 'Grateful for supportive friends.',
    parts_data: null,
    created_at: '2024-09-29T20:00:00Z',
    updated_at: '2024-09-29T20:00:00Z',
  }

  const requests: QueryRequest[] = []
  const client = createStubClient<CheckInRow[]>((request) => {
    requests.push(request)
    return { data: [checkInA, checkInB], error: null }
  })

  const telemetryEvents: Array<{ tool: string }> = []
  const telemetry = {
    async record(event: { tool: string }) {
      telemetryEvents.push(event)
    },
  }

  const modulePath = '@/lib/inbox/search/checkins?test=' + Date.now()
  const { searchCheckIns, listCheckIns, getCheckInDetail } = await import(modulePath)

  const searchResult = await searchCheckIns(
    {
      userId: 'user-1',
      query: 'gratitude',
      limit: 1,
    },
    { client, telemetry },
  )

  assert.equal(searchResult.matches.length, 1)
  assert.equal(searchResult.truncated, true)
  assert.ok(telemetryEvents.some((event) => event.tool === 'checkins.search'))

  const listResult = await listCheckIns(
    {
      userId: 'user-1',
      limit: 1,
    },
    { client, telemetry },
  )

  assert.equal(listResult.items.length, 1)
  assert.equal(listResult.truncated, true)
  assert.ok(telemetryEvents.some((event) => event.tool === 'checkins.list'))

  const detailClient = createStubClient<CheckInRow | null>(() => ({ data: checkInA, error: null }))
  const detailResult = await getCheckInDetail(
    {
      userId: 'user-1',
      checkInId: 'check-1',
    },
    { client: detailClient, telemetry },
  )

  assert.ok(detailResult)
  assert.equal(detailResult?.checkInId, 'check-1')
  assert.equal(detailResult?.gratitude, 'Thankful for deep breaths.')
  assert.ok(telemetryEvents.some((event) => event.tool === 'checkins.get'))

  const hasUserFilter = requests.some((request) =>
    request.filters.some((filter) => filter.op === 'eq' && filter.column === 'user_id' && filter.value === 'user-1'),
  )
  assert.equal(hasUserFilter, true)
}

main().catch((error) => {
  console.error('inbox-checkins-search tests failed:', error)
  process.exit(1)
})
