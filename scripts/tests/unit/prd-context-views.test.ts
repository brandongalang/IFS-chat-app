process.env.SERVER_ONLY_DISABLE_GUARD = 'true'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const partIdA = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const partIdB = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const sessionId = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
const observationId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
const relationshipId = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
const timelineEventId = '99999999-9999-9999-9999-999999999999'
const now = new Date().toISOString()

const samplePartDisplayRow = {
  user_id: userId,
  id: partIdA,
  display_name: 'Creative Part',
  name: 'Creative Part',
  placeholder: null,
  category: 'manager',
  status: 'active',
  charge: 'positive',
  emoji: '🎨',
  age: '8',
  role: 'Artist',
  confidence: 0.8,
  evidence_count: 5,
  needs_attention: false,
  last_active: now,
  created_at: now,
  observation_count: 3,
  last_observed_at: now,
  relationship_count: 2,
  last_relationship_at: now,
}

const timelineObservationRow = {
  user_id: userId,
  created_at: now,
  event_type: 'observation' as const,
  event_subtype: 'pattern',
  description: 'Observed pattern shift',
  entities: [partIdA],
  metadata: { intensity: 'high' },
  source_id: observationId,
  source_table: 'observations' as const,
  session_id: sessionId,
}

const timelinePartRow = {
  user_id: userId,
  created_at: now,
  event_type: 'part' as const,
  event_subtype: 'active',
  description: 'Creative Part activated',
  entities: [partIdA],
  metadata: { role: 'Artist' },
  source_id: partIdA,
  source_table: 'parts_v2' as const,
  session_id: null,
}

const timelineRelationshipRow = {
  user_id: userId,
  created_at: now,
  event_type: 'relationship' as const,
  event_subtype: 'supports',
  description: 'Protector supports Creative Part',
  entities: [partIdA, partIdB],
  metadata: {
    strength: 0.6,
    context: 'Provides stability during sessions',
    observations: ['support_observation'],
  },
  source_id: relationshipId,
  source_table: 'part_relationships_v2' as const,
  session_id: null,
}

const timelineEventRow = {
  user_id: userId,
  created_at: now,
  event_type: 'timeline_event' as const,
  event_subtype: 'integration',
  description: 'Milestone logged',
  entities: [partIdA],
  metadata: { milestone: 'integration-complete' },
  source_id: timelineEventId,
  source_table: 'timeline_events' as const,
  session_id: sessionId,
}

const sampleContextRow = {
  user_id: userId,
  recent_parts: [
    {
      id: partIdA,
      display_name: 'Creative Part',
      category: 'manager',
      status: 'active',
      charge: 'positive',
      needs_attention: false,
      last_active: now,
      emoji: '🎨',
    },
  ],
  incomplete_parts: [
    {
      id: partIdB,
      display_name: 'Protector',
      next_step: 'needs_details',
      updated_at: now,
    },
  ],
  follow_ups: [
    {
      id: observationId,
      content: 'Check in on creative journaling',
      type: 'pattern',
      created_at: now,
    },
  ],
  recent_events: [timelineObservationRow],
  last_session: {
    id: sessionId,
    type: 'therapy',
    summary: 'Focused on creative confidence',
    key_insights: ['Creative energy returning'],
    homework: ['Draw daily for 10 minutes'],
    next_session: ['Review creative progress'],
    started_at: now,
    ended_at: now,
  },
  cache_time: now,
  last_observation_at: now,
  total_sessions: 4,
  total_parts: 6,
  attention_count: 1,
}

async function main() {
  const {
    partDisplayRowSchema,
    timelineDisplayRowSchema,
    userContextCacheRowSchema,
    listPartsDisplay,
    getPartDisplay,
    listTimelineDisplay,
    getUserContextCache,
    refreshUserContextCache,
  } = await import('../../../lib/data/schema/context')

  const parsedPart = partDisplayRowSchema.parse(samplePartDisplayRow)
  assert(parsedPart.id === samplePartDisplayRow.id, 'part display schema retains id')
  assert(parsedPart.relationship_count === 2, 'part display schema captures relationship count')

  const parsedObservationEvent = timelineDisplayRowSchema.parse(timelineObservationRow)
  assert(parsedObservationEvent.event_type === 'observation', 'timeline schema parses observation events')

  const parsedPartEvent = timelineDisplayRowSchema.parse(timelinePartRow)
  assert(parsedPartEvent.event_type === 'part', 'timeline schema parses part events')
  assert(
    (parsedPartEvent.metadata as Record<string, unknown>).role === 'Artist',
    'part metadata preserved'
  )

  const parsedRelationshipEvent = timelineDisplayRowSchema.parse(timelineRelationshipRow)
  assert(parsedRelationshipEvent.event_type === 'relationship', 'timeline schema parses relationship events')
  assert(
    (parsedRelationshipEvent.metadata as { strength?: number }).strength === 0.6,
    'relationship metadata retains strength'
  )

  const parsedTimelineEvent = timelineDisplayRowSchema.parse(timelineEventRow)
  assert(parsedTimelineEvent.event_type === 'timeline_event', 'timeline schema parses timeline events')

  const parsedContext = userContextCacheRowSchema.parse(sampleContextRow)
  assert(parsedContext.recent_parts.length === 1, 'context cache includes recent parts')
  assert(parsedContext.last_session?.key_insights.length === 1, 'context cache preserves last session insights')

  let capturedPartsLimit = 0
  let appliedUserFilter = 0
  const listClient = {
    from(table: string) {
      assert(table === 'parts_display', 'listPartsDisplay queries parts_display view')
      return {
        select(columns: string) {
          assert(columns === '*', 'listPartsDisplay selects all columns')
          return this
        },
        eq(column: string, value: string) {
          assert(column === 'user_id', 'listPartsDisplay filters by user_id')
          assert(value === userId, 'listPartsDisplay uses provided userId')
          appliedUserFilter++
          return this
        },
        order(column: string, options: { ascending?: boolean }) {
          assert(column === 'last_active', 'listPartsDisplay orders by last_active')
          assert(options?.ascending === false, 'listPartsDisplay orders descending by default')
          return this
        },
        limit(limit: number) {
          capturedPartsLimit = limit
          return Promise.resolve({ data: [samplePartDisplayRow], error: null })
        },
      }
    },
  }
  const parts = await listPartsDisplay({ client: listClient as any, userId }, 25)
  assert(capturedPartsLimit === 25, 'listPartsDisplay forwards provided limit')
  assert(appliedUserFilter === 1, 'listPartsDisplay applies user filter once')
  assert(parts.length === 1 && parts[0].id === samplePartDisplayRow.id, 'listPartsDisplay parses returned rows')

  let defaultLimit = 0
  const defaultClient = {
    from() {
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        order() {
          return this
        },
        limit(limit: number) {
          defaultLimit = limit
          return Promise.resolve({ data: [], error: null })
        },
      }
    },
  }
  await listPartsDisplay({ client: defaultClient as any, userId })
  assert(defaultLimit === 50, 'listPartsDisplay uses default limit of 50')

  const errorClient = {
    from() {
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        order() {
          return this
        },
        limit() {
          return Promise.resolve({ data: null, error: { message: 'parts failure' } })
        },
      }
    },
  }
  let listErrorCaught = false
  try {
    await listPartsDisplay({ client: errorClient as any, userId })
  } catch (error) {
    listErrorCaught = true
    assert(error instanceof Error, 'listPartsDisplay throws Error type')
    assert((error as Error).message.includes('parts failure'), 'listPartsDisplay surfaces Supabase error')
  }
  assert(listErrorCaught, 'listPartsDisplay should throw when Supabase returns error')

  const getClient = {
    from(table: string) {
      assert(table === 'parts_display', 'getPartDisplay queries parts_display view')
      return {
        select(columns: string) {
          assert(columns === '*', 'getPartDisplay selects all columns')
          return this
        },
        eq(column: string, value: string) {
          if (column === 'user_id') {
            assert(value === userId, 'getPartDisplay filters by user')
          } else if (column === 'id') {
            assert(value === samplePartDisplayRow.id, 'getPartDisplay filters by id')
          } else {
            throw new Error(`Unexpected column ${column}`)
          }
          return this
        },
        maybeSingle() {
          return Promise.resolve({ data: samplePartDisplayRow, error: null })
        },
      }
    },
  }
  const part = await getPartDisplay(samplePartDisplayRow.id, { client: getClient as any, userId })
  assert(part?.id === samplePartDisplayRow.id, 'getPartDisplay returns parsed row')

  const missingClient = {
    from() {
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        maybeSingle() {
          return Promise.resolve({ data: null, error: null })
        },
      }
    },
  }
  const missing = await getPartDisplay(samplePartDisplayRow.id, { client: missingClient as any, userId })
  assert(missing === null, 'getPartDisplay returns null when no data returned')

  const noRowsClient = {
    from() {
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        maybeSingle() {
          return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'No rows' } })
        },
      }
    },
  }
  const noRows = await getPartDisplay(samplePartDisplayRow.id, { client: noRowsClient as any, userId })
  assert(noRows === null, 'getPartDisplay suppresses PGRST116 errors')

  const failingClient = {
    from() {
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        maybeSingle() {
          return Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied' } })
        },
      }
    },
  }
  let getErrorCaught = false
  try {
    await getPartDisplay(samplePartDisplayRow.id, { client: failingClient as any, userId })
  } catch (error) {
    getErrorCaught = true
    assert(error instanceof Error, 'getPartDisplay throws on unexpected error')
    assert((error as Error).message.includes('permission denied'), 'getPartDisplay surfaces error message')
  }
  assert(getErrorCaught, 'getPartDisplay should throw on unexpected errors')

  let capturedTimelineLimit = 0
  const timelineClient = {
    from(table: string) {
      assert(table === 'timeline_display', 'listTimelineDisplay queries timeline_display view')
      return {
        select(columns: string) {
          assert(columns === '*', 'listTimelineDisplay selects all columns')
          return this
        },
        eq(column: string, value: string) {
          assert(column === 'user_id', 'listTimelineDisplay filters by user_id')
          assert(value === userId, 'listTimelineDisplay uses provided userId')
          return this
        },
        order(column: string, options: { ascending?: boolean }) {
          assert(column === 'created_at', 'listTimelineDisplay orders by created_at')
          assert(options?.ascending === false, 'listTimelineDisplay sorts descending')
          return this
        },
        limit(limit: number) {
          capturedTimelineLimit = limit
          return Promise.resolve({
            data: [timelineObservationRow, timelinePartRow, timelineRelationshipRow, timelineEventRow],
            error: null,
          })
        },
      }
    },
  }
  const timelineRows = await listTimelineDisplay({ client: timelineClient as any, userId })
  assert(capturedTimelineLimit === 100, 'listTimelineDisplay uses default limit of 100')
  assert(timelineRows.length === 4, 'listTimelineDisplay returns all events')
  assert(timelineRows[0].event_type === 'observation', 'listTimelineDisplay preserves event data')

  const timelineErrorClient = {
    from() {
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        order() {
          return this
        },
        limit() {
          return Promise.resolve({ data: null, error: { message: 'timeline failure' } })
        },
      }
    },
  }
  let timelineErrorCaught = false
  try {
    await listTimelineDisplay({ client: timelineErrorClient as any, userId })
  } catch (error) {
    timelineErrorCaught = true
    assert(error instanceof Error, 'listTimelineDisplay throws Error on failure')
    assert((error as Error).message.includes('timeline failure'), 'listTimelineDisplay propagates Supabase error')
  }
  assert(timelineErrorCaught, 'listTimelineDisplay should throw when Supabase reports an error')

  const cacheClient = {
    from(table: string) {
      assert(table === 'user_context_cache', 'getUserContextCache queries materialized view')
      return {
        select(columns: string) {
          assert(columns === '*', 'getUserContextCache selects all columns')
          return this
        },
        eq(column: string, value: string) {
          assert(column === 'user_id', 'getUserContextCache filters by user')
          assert(value === userId, 'getUserContextCache uses provided userId')
          return this
        },
        maybeSingle() {
          return Promise.resolve({ data: sampleContextRow, error: null })
        },
      }
    },
  }
  const cache = await getUserContextCache({ client: cacheClient as any, userId })
  assert(cache?.total_sessions === 4, 'getUserContextCache returns parsed totals')

  const cacheMissingClient = {
    from() {
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        maybeSingle() {
          return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'No rows' } })
        },
      }
    },
  }
  const missingCache = await getUserContextCache({ client: cacheMissingClient as any, userId })
  assert(missingCache === null, 'getUserContextCache returns null when cache missing')

  const cacheErrorClient = {
    from() {
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        maybeSingle() {
          return Promise.resolve({ data: null, error: { code: 'XX000', message: 'cache exploded' } })
        },
      }
    },
  }
  let cacheErrorCaught = false
  try {
    await getUserContextCache({ client: cacheErrorClient as any, userId })
  } catch (error) {
    cacheErrorCaught = true
    assert(error instanceof Error, 'getUserContextCache throws Error on failure')
    assert((error as Error).message.includes('cache exploded'), 'getUserContextCache propagates error message')
  }
  assert(cacheErrorCaught, 'getUserContextCache should throw when Supabase returns unexpected error')

  let refreshCalled = false
  const refreshClient = {
    rpc(name: string) {
      refreshCalled = true
      assert(name === 'refresh_user_context_cache', 'refreshUserContextCache calls RPC name')
      return Promise.resolve({ error: null })
    },
  }
  await refreshUserContextCache(refreshClient as any)
  assert(refreshCalled, 'refreshUserContextCache triggers Supabase RPC')

  const refreshErrorClient = {
    rpc() {
      return Promise.resolve({ error: { message: 'refresh failed' } })
    },
  }
  let refreshErrorCaught = false
  try {
    await refreshUserContextCache(refreshErrorClient as any)
  } catch (error) {
    refreshErrorCaught = true
    assert(error instanceof Error, 'refreshUserContextCache throws Error on failure')
    assert((error as Error).message.includes('refresh failed'), 'refreshUserContextCache surfaces error message')
  }
  assert(refreshErrorCaught, 'refreshUserContextCache should throw when Supabase RPC fails')

  console.log('prd-context-views unit test passed')
}

main().catch((err) => {
  console.error('prd-context-views unit test failed:', err)
  process.exit(1)
})
