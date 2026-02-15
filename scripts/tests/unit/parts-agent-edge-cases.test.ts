
process.env.SERVER_ONLY_DISABLE_GUARD = 'true'

async function main() {
  const { createEmergingPart, logRelationship, updatePart } = await import('../../../lib/data/schema/parts-agent')

  const userId = '123e4567-e89b-12d3-a456-426614174000'
  const partId1 = '11111111-1111-1111-1111-111111111111'
  const partId2 = '22222222-2222-2222-2222-222222222222'
  const sessionId = '33333333-3333-3333-3333-333333333333'

  // Mock DB state
  const partsDb = [
    { id: partId1, user_id: userId, name: 'angry', status: 'active', confidence: 0.5, evidence_count: 5, recent_evidence: [], data: {} },
    { id: partId2, user_id: userId, name: 'happy', status: 'active', confidence: 0.5, evidence_count: 5, recent_evidence: [], data: {} }
  ]
  const relationshipsDb: any[] = []

  // Mock Client
  const client = {
    from: (table: string) => {
      // Common return object for chainable methods
      const queryBuilder: any = {
        select: (cols: string) => queryBuilder,
        eq: (col: string, val: any) => {
           queryBuilder._filters = queryBuilder._filters || []
           queryBuilder._filters.push({ col, val, type: 'eq' })
           return queryBuilder
        },
        ilike: (col: string, val: string) => {
           queryBuilder._filters = queryBuilder._filters || []
           queryBuilder._filters.push({ col, val, type: 'ilike' })
           return queryBuilder
        },
        neq: (col: string, val: any) => {
           queryBuilder._filters = queryBuilder._filters || []
           queryBuilder._filters.push({ col, val, type: 'neq' })
           return queryBuilder
        },
        or: (condition: string) => {
           queryBuilder._filters = queryBuilder._filters || []
           queryBuilder._filters.push({ condition, type: 'or' })
           return queryBuilder
        },
        order: () => queryBuilder,
        limit: () => queryBuilder,
        maybeSingle: async () => {
           // Simulate parts_v2 uniqueness check and getPart
           if (table === 'parts_v2') {
               const filters = queryBuilder._filters || []
               const userIdFilter = filters.find((f: any) => f.col === 'user_id' && f.type === 'eq')
               const nameFilter = filters.find((f: any) => f.col === 'name' && f.type === 'eq')
               const ilikeNameFilter = filters.find((f: any) => f.col === 'name' && f.type === 'ilike')
               const idFilter = filters.find((f: any) => f.col === 'id' && f.type === 'eq')
               const neqIdFilter = filters.find((f: any) => f.col === 'id' && f.type === 'neq')

               // Case 1: Exact name check (legacy, but if used)
               if (userIdFilter && nameFilter) {
                   const found = partsDb.find(p => p.user_id === userIdFilter.val && p.name === nameFilter.val)
                   return { data: found || null, error: null }
               }

               // Case 2: ILIKE name check (new)
               if (userIdFilter && ilikeNameFilter) {
                   // Remove SQL wildcards/escapes for simple match simulation
                   const pattern = ilikeNameFilter.val.replace(/\\/g, '').replace(/%/g, '')
                   const found = partsDb.find(p =>
                       p.user_id === userIdFilter.val &&
                       p.name.toLowerCase() === pattern.toLowerCase() &&
                       (!neqIdFilter || p.id !== neqIdFilter.val)
                   )
                   return { data: found || null, error: null }
               }

               // Case 3: Get by ID
               if (userIdFilter && idFilter) {
                    const found = partsDb.find(p => p.id === idFilter.val && p.user_id === userIdFilter.val)
                    return { data: found || null, error: null }
               }
           }
           return { data: null, error: null }
        },
        then: (resolve: any) => {
           // For logRelationship candidates list
           resolve({ data: [], error: null })
        },
        insert: (payload: any) => queryBuilder,
        update: (payload: any) => queryBuilder,
        single: async () => {
            return { data: { id: '44444444-4444-4444-4444-444444444444', user_id: userId }, error: null }
        }
      }
      return queryBuilder
    }
  }

  // TEST 1: Create Emerging Part with Case Mismatch
  console.log('Test 1: Create Emerging Part with Case Mismatch')
  try {
    await createEmergingPart({
      name: 'Angry', // Capital 'A', DB has 'angry'
      evidence: [
          { type: 'direct_mention', content: 'ev1', confidence: 0.9, sessionId: sessionId, timestamp: new Date().toISOString() },
          { type: 'direct_mention', content: 'ev2', confidence: 0.9, sessionId: sessionId, timestamp: new Date().toISOString() },
          { type: 'direct_mention', content: 'ev3', confidence: 0.9, sessionId: sessionId, timestamp: new Date().toISOString() }
      ],
      userConfirmed: true // BYPASS CONFIRMATION CHECK
    }, { client: client as any, userId })
    console.log('[FAIL] Created duplicate part "Angry" despite "angry" existing')
  } catch (e: any) {
    if (e.message.includes('already exists')) {
        console.log('[PASS] Caught duplicate name')
    } else {
        console.log('[ERROR] Unexpected error:', e.message)
    }
  }

  // TEST 2: Self-Referential Relationship
  console.log('\nTest 2: Self-Referential Relationship')
  try {
    await logRelationship({
        partIds: [partId1, partId1],
        type: 'polarized'
    }, { client: client as any, userId })
    console.log('[FAIL] Created self-referential relationship')
  } catch (e: any) {
      if (e.message.includes('Cannot create self-referential relationship')) {
          console.log('[PASS] Caught self-referential relationship')
      } else {
          console.log('[ERROR] Unexpected error:', e.message)
      }
  }

  // TEST 3: Rename to Existing Name
  console.log('\nTest 3: Rename to Existing Name')
  try {
      // Rename 'angry' (part1) to 'happy' (part2 exists)
      await updatePart({
          partId: partId1,
          updates: { name: 'Happy' } // "Happy" matches "happy" via ilike
      }, { client: client as any, userId })
      console.log('[FAIL] Renamed part to existing name "Happy"')
  } catch (e: any) {
      if (e.message.includes('already exists')) {
          console.log('[PASS] Caught duplicate rename')
      } else {
          console.log('[ERROR] Unexpected error:', e.message)
      }
  }

  // TEST 4: Rename to Same Name (Case Change) - Should Succeed
  console.log('\nTest 4: Rename to Same Name (Case Change)')
  try {
      // Rename 'angry' (part1) to 'Angry' (should be allowed as it matches itself but neq excludes it)
      await updatePart({
          partId: partId1,
          updates: { name: 'Angry' }
      }, { client: client as any, userId })
      console.log('[PASS] Allowed case-change rename')
  } catch (e: any) {
      console.log('[FAIL] Blocked case-change rename:', e.message)
  }

}

main().catch(console.error)
