process.env.SERVER_ONLY_DISABLE_GUARD = 'true'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

async function main() {
  const {
    writeTherapyDataSchema,
    queryTherapyDataSchema,
    updateTherapyDataSchema,
    getSessionContextSchema,
    sessionContextResponseSchema,
  } = await import('../../../lib/data/therapy-tools.schema')

  // Test WriteTherapyData schema - observation
  {
    const validObservation = writeTherapyDataSchema.parse({
      type: 'observation',
      data: {
        content: 'Client expressed anxiety about upcoming meeting',
        observationType: 'somatic',
        metadata: { intensity: 0.7 },
      },
    })

    assert(validObservation.type === 'observation', 'observation type parsed')
    assert(
      validObservation.data.content === 'Client expressed anxiety about upcoming meeting',
      'observation content preserved'
    )
    assert(validObservation.data.metadata.intensity === 0.7, 'observation metadata preserved')
  }

  // Test write part
  {
    const validPart = writeTherapyDataSchema.parse({
      type: 'part',
      data: {
        name: 'The Protector',
        category: 'firefighter',
        status: 'acknowledged',
        metadata: { triggers: ['conflict'] },
      },
    })

    assert(validPart.type === 'part', 'part type parsed')
    assert(validPart.data.name === 'The Protector', 'part name preserved')
    assert(validPart.data.category === 'firefighter', 'part category preserved')
  }

  // Test write relationship
  {
    const validRelationship = writeTherapyDataSchema.parse({
      type: 'relationship',
      data: {
        partIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'],
        relationshipType: 'supports',
      },
    })

    assert(validRelationship.type === 'relationship', 'relationship type parsed')
    assert(validRelationship.data.partIds.length === 2, 'relationship partIds preserved')
  }

  // Test QueryTherapyData schema - parts
  {
    const validQuery = queryTherapyDataSchema.parse({
      type: 'parts',
      filters: {
        category: 'manager',
        search: 'protector',
      },
      limit: 10,
    })

    assert(validQuery.type === 'parts', 'query type parsed')
    assert(validQuery.filters.category === 'manager', 'query category filter preserved')
    assert(validQuery.limit === 10, 'query limit preserved')
  }

  // Test observations query
  {
    const observationQuery = queryTherapyDataSchema.parse({
      type: 'observations',
      limit: 20,
    })

    assert(observationQuery.type === 'observations', 'observations query type parsed')
  }

  // Test sessions query
  {
    const sessionsQuery = queryTherapyDataSchema.parse({
      type: 'sessions',
    })

    assert(sessionsQuery.type === 'sessions', 'sessions query type parsed')
  }

  // Test UpdateTherapyData schema
  {
    const validUpdate = updateTherapyDataSchema.parse({
      type: 'part',
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      updates: {
        name: 'Updated Part Name',
        status: 'active',
      },
    })

    assert(validUpdate.type === 'part', 'update type parsed')
    assert(validUpdate.id === 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'update id preserved')
    assert(validUpdate.updates.name === 'Updated Part Name', 'update fields preserved')
  }

  // Test GetSessionContext schema
  {
    const validContext = getSessionContextSchema.parse({})
    assert(Object.keys(validContext).length === 0, 'session context schema is empty object')
  }

  // Test SessionContextResponse schema
  {
    const validResponse = sessionContextResponseSchema.parse({
      timeSinceLastContact: '2 hours ago',
      lastTopics: ['Part integration', 'Trigger management'],
      openThreads: ['Follow up on breathing exercise'],
      partsActive: [
        {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          name: 'The Protector',
          lastActive: new Date().toISOString(),
          triggers: ['conflict'],
        },
      ],
      suggestedFocus: 'Continue exploring protector role',
    })

    assert(validResponse.timeSinceLastContact === '2 hours ago', 'time since last contact preserved')
    assert(validResponse.lastTopics.length === 2, 'last topics array preserved')
    assert(validResponse.partsActive.length === 1, 'parts active array preserved')
  }

  // Test invalid schemas reject bad data
  {
    let validationFailed = false
    try {
      writeTherapyDataSchema.parse({
        type: 'invalid_type',
        data: {},
      })
    } catch (error) {
      validationFailed = true
    }
    assert(validationFailed, 'invalid write type rejected')
  }

  console.log('therapy-tools schema unit test passed')
}

main().catch((err) => {
  console.error('therapy-tools schema unit test failed:', err)
  process.exit(1)
})
