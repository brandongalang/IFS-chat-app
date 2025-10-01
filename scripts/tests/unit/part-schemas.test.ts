import {
  searchPartsSchema,
  getPartByIdSchema,
  getPartDetailSchema,
  createEmergingPartSchema,
  updatePartSchema,
  getPartRelationshipsSchema,
  logRelationshipSchema,
} from '../../../mastra/tools/part-schemas'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

async function main() {
  const uuid1 = '11111111-1111-1111-1111-111111111111'
  const uuid2 = '22222222-2222-2222-2222-222222222222'
  const uuid3 = '33333333-3333-3333-3333-333333333333'
  const uuid4 = '44444444-4444-4444-4444-444444444444'
  const now = new Date().toISOString()

  searchPartsSchema.parse({
    query: 'firefighter',
    status: 'emerging',
    category: 'manager',
    limit: 5,
  })

  getPartByIdSchema.parse({ partId: uuid1 })
  getPartDetailSchema.parse({ partId: uuid1 })

  createEmergingPartSchema.parse({
    name: 'Inner Critic',
    evidence: [
      {
        type: 'direct_mention',
        content: 'Said I am not good',
        confidence: 0.9,
        sessionId: uuid3,
        timestamp: now,
      },
      {
        type: 'pattern',
        content: 'Always complains',
        confidence: 0.8,
        sessionId: uuid3,
        timestamp: now,
      },
      {
        type: 'behavior',
        content: 'Avoids tasks',
        confidence: 0.7,
        sessionId: uuid3,
        timestamp: now,
      },
    ],
    category: 'manager',
    age: 12,
    role: 'Critic',
    triggers: ['failure'],
    emotions: ['shame'],
    beliefs: ['must be perfect'],
    somaticMarkers: ['tight chest'],
    userConfirmed: true,
  })

  updatePartSchema.parse({
    partId: uuid1,
    updates: {
      name: 'New Name',
      status: 'acknowledged',
      category: 'manager',
      age: 13,
      role: 'Helper',
      triggers: ['stress'],
      emotions: ['anger'],
      beliefs: ['I must protect'],
      somaticMarkers: ['stiff shoulders'],
      visualization: { emoji: '🔥', color: '#ff0000' },
      confidenceBoost: 0.1,
      last_charged_at: now,
      last_charge_intensity: 0.5,
    },
    evidence: {
      type: 'behavior',
      content: 'Calmed down',
      confidence: 0.8,
      sessionId: uuid3,
      timestamp: now,
    },
    auditNote: 'Updated after session',
  })

  getPartRelationshipsSchema.parse({
    partId: uuid1,
    relationshipType: 'polarized',
    status: 'active',
    includePartDetails: true,
    limit: 10,
  })

  logRelationshipSchema.parse({
    partIds: [uuid1, uuid4],
    type: 'allied',
    description: 'Work together',
    issue: 'None',
    commonGround: 'Shared goal',
    status: 'active',
    polarizationLevel: 0.2,
    dynamic: {
      observation: 'Helped each other',
      context: 'Meeting',
      polarizationChange: -0.1,
      timestamp: now,
    },
    lastAddressed: now,
    upsert: true,
  })

  assert(true, 'schemas validated')
  console.log('part-schemas unit test passed')
}

main().catch((err) => {
  console.error('part-schemas unit test failed:', err)
  process.exit(1)
})
