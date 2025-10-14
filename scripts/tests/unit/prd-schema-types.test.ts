process.env.SERVER_ONLY_DISABLE_GUARD = 'true'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

async function main() {
  const {
    partRowSchema,
    sessionRowSchema,
    observationRowSchema,
    partRelationshipRowSchema,
    timelineEventRowSchema,
    assertPrdDeps,
    mergeObservationFollowUpMetadata,
  } = await import('../../../lib/data/schema')

  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const partIdA = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  const partIdB = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  const sessionId = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
  const observationId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
  const relationshipId = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
  const timelineEventId = '99999999-9999-9999-9999-999999999999'
  const now = new Date().toISOString()

  const parsedPart = partRowSchema.parse({
    id: partIdA,
    user_id: userId,
    name: 'Inner Manager',
    placeholder: null,
    category: 'manager',
    status: 'active',
    charge: 'neutral',
    data: {},
    needs_attention: false,
    confidence: 0.65,
    evidence_count: 3,
    first_noticed: now,
    last_active: now,
    created_at: now,
    updated_at: now,
  })

  assert(parsedPart.name === 'Inner Manager', 'part schema preserves fields')

  const parsedSession = sessionRowSchema.parse({
    id: sessionId,
    user_id: userId,
    type: 'therapy',
    observations: [observationId],
    parts_present: [partIdA, partIdB],
    summary: null,
    key_insights: ['Gained awareness'],
    breakthroughs: [],
    resistance_notes: [],
    homework: ['Journal'],
    next_session: ['Plan follow-up'],
    metadata: {},
    started_at: now,
    ended_at: null,
    last_message_at: now,
    created_at: now,
    updated_at: now,
  })

  assert(parsedSession.parts_present.length === 2, 'session schema parses arrays')

  const parsedObservation = observationRowSchema.parse({
    id: observationId,
    user_id: userId,
    session_id: sessionId,
    type: 'pattern',
    content: 'Shows up when under pressure',
    metadata: {},
    entities: [partIdA],
    created_at: now,
    updated_at: now,
  })

  assert(parsedObservation.entities[0] === partIdA, 'observation schema parses entities')

  const parsedRelationship = partRelationshipRowSchema.parse({
    id: relationshipId,
    user_id: userId,
    part_a_id: partIdA,
    part_b_id: partIdB,
    type: 'supports',
    strength: 0.7,
    context: 'Teams up during work stress',
    observations: [observationId],
    created_at: now,
    updated_at: now,
  })

  assert(parsedRelationship.id === relationshipId, 'relationship schema parses id')

  const parsedTimelineEvent = timelineEventRowSchema.parse({
    id: timelineEventId,
    user_id: userId,
    session_id: sessionId,
    type: 'breakthrough',
    description: 'Identified proactive protector role',
    entities: [partIdA],
    metadata: {},
    created_at: now,
  })

  assert(parsedTimelineEvent.type === 'breakthrough', 'timeline schema parses type')

  const fakeClient = {} as any
  const deps = assertPrdDeps({ client: fakeClient, userId })
  assert(deps.userId === userId, 'assertPrdDeps returns validated dependencies')

  let invalidCaught = false
  try {
    assertPrdDeps({ client: fakeClient, userId: 'not-a-uuid' })
  } catch (error) {
    invalidCaught = true
    assert(error instanceof Error, 'invalid dependency throws Error')
  }

  assert(invalidCaught, 'invalid userId should fail validation')

  const existingMetadata = { followUp: 'true', note: 'call tomorrow' }
  const mergedWithUpdate = mergeObservationFollowUpMetadata(existingMetadata, {
    metadata: { note: 'call next week', extra: 'value' },
  })

  assert(mergedWithUpdate.followUp === 'true', 'merge preserves prior followUp flag')
  assert(mergedWithUpdate.note === 'call next week', 'merge applies metadata overrides')
  assert(mergedWithUpdate.extra === 'value', 'merge includes new metadata keys')

  const mergedWithCompletion = mergeObservationFollowUpMetadata(mergedWithUpdate, {
    completed: true,
  })

  assert(mergedWithCompletion.completed === 'true', 'completed flag stored as string true')

  const mergedRemovingCompletion = mergeObservationFollowUpMetadata(mergedWithCompletion, {
    completed: false,
  })

  assert(!('completed' in mergedRemovingCompletion), 'completed flag removed when set to false')

  console.log('prd-schema-types unit test passed')
}

main().catch((err) => {
  console.error('prd-schema-types unit test failed:', err)
  process.exit(1)
})
