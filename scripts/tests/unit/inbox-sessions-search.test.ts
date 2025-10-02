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

type SessionMessage = {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

type SessionRow = {
  id: string
  user_id: string
  start_time: string
  end_time: string | null
  duration: number | null
  messages: SessionMessage[]
  summary: string | null
  parts_involved: Record<string, unknown>
  new_parts: string[]
  breakthroughs: string[]
  emotional_arc: {
    start: { valence: number; arousal: number }
    peak: { valence: number; arousal: number }
    end: { valence: number; arousal: number }
  }
  processed: boolean
  processed_at: string | null
  created_at: string
  updated_at: string
}

async function main() {
  const sessionA: SessionRow = {
    id: 'session-1',
    user_id: 'user-1',
    start_time: '2024-09-30T10:00:00Z',
    end_time: '2024-09-30T11:00:00Z',
    duration: null,
    messages: [
      { role: 'assistant', content: 'Focus on breathing exercises today.', timestamp: '2024-09-30T10:05:00Z' },
      { role: 'user', content: 'Breathing helped me stay calm.', timestamp: '2024-09-30T10:20:00Z' },
    ],
    summary: 'Reviewed breathing patterns and calm techniques.',
    parts_involved: {},
    new_parts: [],
    breakthroughs: [],
    emotional_arc: {
      start: { valence: 0, arousal: 0.2 },
      peak: { valence: 0.4, arousal: 0.6 },
      end: { valence: 0.2, arousal: 0.3 },
    },
    processed: false,
    processed_at: null,
    created_at: '2024-09-30T10:00:00Z',
    updated_at: '2024-09-30T10:00:00Z',
  }

  const sessionB: SessionRow = {
    id: 'session-2',
    user_id: 'user-1',
    start_time: '2024-09-29T09:00:00Z',
    end_time: '2024-09-29T09:45:00Z',
    duration: null,
    messages: [
      { role: 'assistant', content: 'Shift focus to journaling.', timestamp: '2024-09-29T09:10:00Z' },
    ],
    summary: 'Discussed journaling habits.',
    parts_involved: {},
    new_parts: [],
    breakthroughs: [],
    emotional_arc: {
      start: { valence: 0.1, arousal: 0.3 },
      peak: { valence: 0.3, arousal: 0.5 },
      end: { valence: 0.2, arousal: 0.3 },
    },
    processed: false,
    processed_at: null,
    created_at: '2024-09-29T09:00:00Z',
    updated_at: '2024-09-29T09:00:00Z',
  }

  const requests: QueryRequest[] = []
  const client = createStubClient<SessionRow[]>((request) => {
    requests.push(request)
    return { data: [sessionA, sessionB], error: null }
  })

  const telemetryEvents: Array<{ tool: string }> = []
  const telemetry = {
    async record(event: { tool: string }) {
      telemetryEvents.push(event)
    },
  }

  const modulePath = '@/lib/inbox/search/sessions?test=' + Date.now()
  const { searchSessions, listSessions, getSessionDetail } = await import(modulePath)

  const searchResult = await searchSessions(
    {
      userId: 'user-1',
      query: 'breathing',
      limit: 1,
    },
    { client, telemetry },
  )

  assert.equal(searchResult.matches.length, 1)
  assert.equal(searchResult.truncated, true)
  assert.ok(telemetryEvents.some((event) => event.tool === 'sessions.search'))

  const listResult = await listSessions(
    {
      userId: 'user-1',
      limit: 1,
    },
    { client, telemetry },
  )

  assert.equal(listResult.items.length, 1)
  assert.equal(listResult.truncated, true)
  assert.ok(telemetryEvents.some((event) => event.tool === 'sessions.list'))

  const detailClient = createStubClient<SessionRow | null>(() => ({ data: sessionA, error: null }))
  const detailResult = await getSessionDetail(
    {
      userId: 'user-1',
      sessionId: 'session-1',
      pageSize: 1,
    },
    { client: detailClient, telemetry },
  )

  assert.ok(detailResult)
  assert.equal(detailResult?.messages.length, 2)
  assert.equal(detailResult?.nextPage, null)
  assert.ok(telemetryEvents.some((event) => event.tool === 'sessions.get'))

  // Ensure requests captured expected filters
  const hasUserFilter = requests.some((request) =>
    request.filters.some((filter) => filter.op === 'eq' && filter.column === 'user_id' && filter.value === 'user-1'),
  )
  assert.equal(hasUserFilter, true)
}

main().catch((error) => {
  console.error('inbox-sessions-search tests failed:', error)
  process.exit(1)
})
