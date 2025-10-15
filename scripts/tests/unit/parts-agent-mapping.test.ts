process.env.SERVER_ONLY_DISABLE_GUARD = 'true'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

async function main() {
  const { __test } = await import('../../../lib/data/schema/parts-agent')

  const partRowV2 = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'Inner Critic',
    placeholder: null,
    category: 'manager',
    status: 'active',
    charge: 'neutral',
    data: {
      age: 12,
      role: 'protector',
      triggers: ['work'],
      emotions: ['anxiety'],
      beliefs: ['must be perfect'],
      somatic_markers: ['tight chest'],
      recent_evidence: [
        {
          type: 'direct_mention',
          content: 'I felt a harsh inner voice during the meeting',
          confidence: 0.8,
          sessionId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          timestamp: new Date().toISOString(),
        },
      ],
      story: {
        origin: 'Childhood pressure',
        currentState: 'Very active',
        purpose: 'Keeping standards high',
        evolution: [
          {
            timestamp: new Date().toISOString(),
            change: 'Identified in journaling',
            trigger: 'Work review',
          },
        ],
      },
      visualization: {
        emoji: '🎭',
        color: '#222222',
        energyLevel: 0.7,
      },
      acknowledged_at: null,
      last_interaction_at: null,
      last_charged_at: null,
      last_charge_intensity: null,
    },
    needs_attention: false,
    confidence: 0.6,
    evidence_count: 1,
    first_noticed: new Date().toISOString(),
    last_active: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const legacyPart = __test.mapPartRow(partRowV2 as any)
  assert(legacyPart.name === 'Inner Critic', 'maps part name')
  assert(legacyPart.role === 'protector', 'maps role from data')
  assert(Array.isArray(legacyPart.recent_evidence) && legacyPart.recent_evidence.length === 1, 'maps evidence array')
  assert(legacyPart.visualization.emoji === '🎭', 'maps visualization emoji')

  const contextPayload = { description: 'Tense dynamic', polarizationLevel: 0.8 }
  const encodedContext = __test.encodeRelationshipContext(contextPayload)
  assert(typeof encodedContext === 'string', 'encodes relationship context to string')
  const decodedContext = __test.parseRelationshipContext(encodedContext)
  assert(decodedContext.description === 'Tense dynamic', 'decodes context description')
  assert(decodedContext.polarizationLevel === 0.8, 'decodes polarization level')

  const dynamics = [
    {
      observation: 'Raised voice when deadlines loom',
      context: 'Work projects',
      polarizationChange: 0.1,
      timestamp: new Date().toISOString(),
    },
  ]
  const encodedDynamics = __test.encodeRelationshipDynamics(dynamics)
  assert(Array.isArray(encodedDynamics) && encodedDynamics.length === 1, 'encodes dynamics array')
  const decodedDynamics = __test.parseRelationshipObservations(encodedDynamics)
  assert(decodedDynamics.length === 1 && decodedDynamics[0].observation === dynamics[0].observation, 'decodes dynamics')

  assert(__test.toV2RelationshipType('polarized') === 'conflicts', 'maps legacy polarized to conflicts')
  assert(__test.fromV2RelationshipType('protects') === 'protector-exile', 'maps protects to protector-exile')

  console.log('parts-agent-mapping unit test passed')
}

main().catch((error) => {
  console.error('parts-agent-mapping unit test failed:', error)
  process.exit(1)
})
