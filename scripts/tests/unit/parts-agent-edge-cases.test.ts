process.env.SERVER_ONLY_DISABLE_GUARD = 'true'

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

async function main() {
  const { createEmergingPart, updatePart } = await import('../../../lib/data/schema/parts-agent')

  // Mock Supabase Client
  const createMockClient = (existingPart: any = null) => {
    return {
      from: (table: string) => ({
        select: (columns: string) => ({
          eq: (column: string, value: any) => ({
            eq: (col2: string, val2: any) => ({
              maybeSingle: async () => ({ data: existingPart, error: null }),
            }),
            ilike: (col2: string, val2: any) => ({
               maybeSingle: async () => {
                 // Simulate ilike behavior
                 if (existingPart && existingPart.name.toLowerCase() === val2.replace(/\\/g, '').toLowerCase()) {
                    return { data: existingPart, error: null }
                 }
                 return { data: null, error: null }
               },
            }),
            neq: (col2: string, val2: any) => ({
              ilike: (col3: string, val3: any) => ({
                 maybeSingle: async () => {
                    // Simulate ilike behavior excluding self
                    if (existingPart && existingPart.id !== val2 && existingPart.name.toLowerCase() === val3.replace(/\\/g, '').toLowerCase()) {
                      return { data: existingPart, error: null }
                    }
                    return { data: null, error: null }
                 }
              })
            })
          }),
          maybeSingle: async () => ({ data: existingPart, error: null }), // Fallback
        }),
        insert: (data: any) => ({
          select: () => ({
            single: async () => ({ data: { ...data, id: '00000000-0000-0000-0000-000000000002' }, error: null })
          })
        }),
        update: (data: any) => ({
          eq: (col: string, val: any) => ({
            select: () => ({
              single: async () => ({ data: { ...existingPart, ...data }, error: null })
            })
          })
        })
      })
    } as any
  }

  // Test 1: createEmergingPart should fail if part exists (case-insensitive)
  {
    const existing = { id: '00000000-0000-0000-0000-000000000003', name: 'Protector' }
    const client = createMockClient(existing)

    try {
      await createEmergingPart({
        name: 'protector', // different case
        evidence: [
          { type: 'pattern', content: 'ev1', confidence: 0.8, sessionId: '00000000-0000-0000-0000-000000000001', timestamp: new Date().toISOString() },
          { type: 'pattern', content: 'ev2', confidence: 0.8, sessionId: '00000000-0000-0000-0000-000000000001', timestamp: new Date().toISOString() },
          { type: 'pattern', content: 'ev3', confidence: 0.8, sessionId: '00000000-0000-0000-0000-000000000001', timestamp: new Date().toISOString() },
        ],
        userConfirmed: true
      }, { client, userId: '00000000-0000-0000-0000-000000000000' })
      assert(false, 'Should have thrown error for duplicate part')
    } catch (e: any) {
      assert(e.message.includes('already exists'), `Expected error about existing part, got: ${e.message}`)
    }
  }

  // Test 2: createEmergingPart should trim name
  {
    const client = createMockClient(null)
    const result = await createEmergingPart({
      name: '  New Part  ',
      evidence: [
          { type: 'pattern', content: 'ev1', confidence: 0.8, sessionId: '00000000-0000-0000-0000-000000000001', timestamp: new Date().toISOString() },
          { type: 'pattern', content: 'ev2', confidence: 0.8, sessionId: '00000000-0000-0000-0000-000000000001', timestamp: new Date().toISOString() },
          { type: 'pattern', content: 'ev3', confidence: 0.8, sessionId: '00000000-0000-0000-0000-000000000001', timestamp: new Date().toISOString() },
      ],
      userConfirmed: true
    }, { client, userId: '00000000-0000-0000-0000-000000000000' })

    assert(result.name === 'New Part', `Expected trimmed name "New Part", got "${result.name}"`)
  }

  // Test 3: updatePart should fail if renaming to existing part (case-insensitive)
  {
    const existing = { id: 'other-id', name: 'Manager' } // Another part exists
    // The client needs to handle multiple calls:
    // 1. Fetch current part (by ID)
    // 2. Check for conflict (by Name, excluding ID)

    // We need a more sophisticated mock for this flow
    const mockClient = {
      from: (table: string) => ({
        select: (cols: string) => {
          // This returns a builder
          const builder: any = {}

          builder.eq = (col: string, val: any) => {
            if (col === 'id' && val === '00000000-0000-0000-0000-000000000004') {
               // Fetching current part
               const res = { data: { id: '00000000-0000-0000-0000-000000000004', name: 'Old Name', user_id: '00000000-0000-0000-0000-000000000000' }, error: null }
               builder.maybeSingle = async () => res
               builder.single = async () => res
               return builder
            }
            if (col === 'user_id') {
              // Start of uniqueness check or fetch
              return builder
            }
            return builder
          }

          builder.neq = (col: string, val: any) => {
             // Excluding current ID
             return builder
          }

          builder.ilike = (col: string, val: any) => {
             // Checking name collision
             if (val.replace(/\\/g, '').toLowerCase() === 'manager') {
                // Found collision
                builder.maybeSingle = async () => ({ data: { id: '00000000-0000-0000-0000-000000000005', name: 'Manager' }, error: null })
             } else {
                builder.maybeSingle = async () => ({ data: null, error: null })
             }
             return builder
          }

          builder.maybeSingle = async () => ({ data: null, error: null }) // Default

          return builder
        },
        update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }) })
      })
    } as any

    try {
      await updatePart({
        partId: '00000000-0000-0000-0000-000000000004',
        updates: { name: 'manager' } // Rename to 'manager', conflicts with 'Manager'
      }, { client: mockClient, userId: '00000000-0000-0000-0000-000000000000' })
      assert(false, 'Should have thrown error for duplicate part on rename')
    } catch (e: any) {
      assert(e.message.includes('already exists'), `Expected error about existing part on rename, got: ${e.message}`)
    }
  }

   // Test 4: updatePart should succeed if renaming to unique name
  {
     const mockClient = {
      from: (table: string) => ({
        select: (cols: string) => {
          const builder: any = {}
          builder.eq = (col: string, val: any) => {
             if (col === 'id' && val === '00000000-0000-0000-0000-000000000004') {
               const res = { data: { id: '00000000-0000-0000-0000-000000000004', name: 'Old Name', user_id: '00000000-0000-0000-0000-000000000000' }, error: null }
               builder.maybeSingle = async () => res
               builder.single = async () => res
               return builder
             }
             return builder
          }
          builder.neq = () => builder
          builder.ilike = () => {
             // No collision
             builder.maybeSingle = async () => ({ data: null, error: null })
             return builder
          }
          builder.maybeSingle = async () => ({ data: null, error: null })
          return builder
        },
        update: (data: any) => ({
            eq: () => ({
                select: () => ({
                    single: async () => ({
                        data: { id: '00000000-0000-0000-0000-000000000004', ...data, user_id: 'user-1' },
                        error: null
                    })
                })
            })
        })
      })
    } as any

    const result = await updatePart({
        partId: '00000000-0000-0000-0000-000000000004',
        updates: { name: '  Unique Name  ' }
    }, { client: mockClient, userId: '00000000-0000-0000-0000-000000000000' })

    assert(result.name === 'Unique Name', `Expected trimmed name "Unique Name", got "${result.name}"`)
  }

  console.log('parts-agent-edge-cases tests passed')
}

main().catch((e) => {
  console.error('Test failed:', e)
  process.exit(1)
})
