import assert from 'node:assert/strict'

/**
 * Unit test for markdown logging entity ID inference
 * Verifies that file extensions and nested paths are properly stripped
 */

async function main() {
  console.log('Running markdown logging unit test...')

  const { computeMarkdownHash, inferEntityContext } = await import('../../../lib/memory/markdown/logging')

  // Test hash computation
  const hash1 = computeMarkdownHash('test content')
  assert(hash1.startsWith('sha256:'), 'Hash should have sha256: prefix')
  assert.equal(hash1.length, 71, 'SHA-256 hash should be 64 chars + 7 char prefix')

  const hash2 = computeMarkdownHash('test content')
  assert.equal(hash1, hash2, 'Same content should produce same hash')

  const hash3 = computeMarkdownHash('different content')
  assert.notEqual(hash1, hash3, 'Different content should produce different hash')

  console.log('✓ Hash computation works correctly')

  // Test entity ID extraction with various path formats
  const userId = 'user-123'
  
  const testCases = [
    {
      path: 'users/user-123/parts/part-456/profile.md',
      expectedType: 'part',
      expectedId: 'part-456',
      description: 'Part profile with nested path',
    },
    {
      path: 'users/user-123/relationships/rel-789/profile.md',
      expectedType: 'relationship',
      expectedId: 'rel-789',
      description: 'Relationship profile with nested path',
    },
    {
      path: 'users/user-123/parts/part-abc.md',
      expectedType: 'part',
      expectedId: 'part-abc',
      description: 'Part with direct .md file',
    },
    {
      path: 'users/user-123/relationships/rel-xyz.md',
      expectedType: 'relationship',
      expectedId: 'rel-xyz',
      description: 'Relationship with direct .md file',
    },
    {
      path: 'users/user-123/overview.md',
      expectedType: 'user',
      expectedId: 'user-123',
      description: 'User overview',
    },
    {
      path: 'users/user-123/parts/550e8400-e29b-41d4-a716-446655440000/profile.md',
      expectedType: 'part',
      expectedId: '550e8400-e29b-41d4-a716-446655440000',
      description: 'Part with UUID in nested path',
    },
  ]

  for (const testCase of testCases) {
    const result = inferEntityContext(testCase.path, userId)
    assert.equal(result.entityType, testCase.expectedType, 
      `Entity type should be ${testCase.expectedType} for ${testCase.description}`)
    assert.equal(result.entityId, testCase.expectedId, 
      `Entity ID should be ${testCase.expectedId} (without .md extension) for ${testCase.description}`)
    console.log(`✓ ${testCase.description}: entityType=${result.entityType}, entityId=${result.entityId}`)
  }

  console.log('Markdown logging unit test passed.')
}

main().catch((error) => {
  console.error('Markdown logging unit test failed:', error)
  process.exit(1)
})
