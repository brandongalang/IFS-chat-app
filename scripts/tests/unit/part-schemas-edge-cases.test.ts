import { z } from 'zod'
import { logRelationshipSchema } from '@/lib/data/parts.schema'
import assert from 'node:assert/strict'

async function testSelfRelationship() {
  const uuid1 = '11111111-1111-1111-1111-111111111111'
  const now = new Date().toISOString()

  const invalidPayload = {
    partIds: [uuid1, uuid1], // Same ID twice
    type: 'allied',
    description: 'Self relationship',
    upsert: true,
  }

  try {
    logRelationshipSchema.parse(invalidPayload)
    // If we get here, the schema accepted it, which is WRONG.
    console.error('FAIL: Schema accepted self-relationship')
    process.exit(1)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log('PASS: Schema rejected self-relationship')
    } else {
      console.error('FAIL: Unexpected error type', error)
      process.exit(1)
    }
  }

  // Test Case Insensitivity
  const invalidPayloadMixed = {
    ...invalidPayload,
    partIds: [uuid1, uuid1.toUpperCase()]
  }

  try {
    logRelationshipSchema.parse(invalidPayloadMixed)
    console.error('FAIL: Schema accepted self-relationship with mixed case')
    process.exit(1)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log('PASS: Schema rejected self-relationship with mixed case')
    } else {
        console.error('FAIL: Unexpected error type mixed case', error)
        process.exit(1)
    }
  }
}

testSelfRelationship()
