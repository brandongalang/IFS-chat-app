/**
 * Unit tests for inbox-to-chat bridge module
 * Tests system instruction generation and session storage helpers
 */

import type { InboxEnvelope, InsightSpotlightEnvelope } from '@/types/inbox'

export {}

async function main() {
  const modulePath = '@/lib/inbox/chat-bridge?test=' + Date.now()
  const {
    generateSystemInstruction,
    packChatContext,
    saveContextToSession,
    readAndClearContextFromSession,
    clearStoredContext,
  } = (await import(modulePath)) as typeof import('@/lib/inbox/chat-bridge')

  console.log('Testing chat bridge module...')

  // Test 1: Generate system instruction for confirmed insight
  const insightEnvelope: InsightSpotlightEnvelope = {
    id: 'test-1',
    sourceId: 'insight-123',
    type: 'insight_spotlight',
    createdAt: new Date().toISOString(),
    updatedAt: null,
    expiresAt: null,
    readAt: null,
    source: 'network',
    payload: {
      insightId: 'insight-123',
      title: 'Pattern Detected',
      summary: 'Your Perfectionist was particularly active in work emails yesterday',
    },
    metadata: {
      partName: 'Perfectionist',
    },
  }

  const confirmedInstruction = generateSystemInstruction(insightEnvelope, 'confirmed')
  assert(confirmedInstruction.includes('CONFIRMED'), 'Confirmed instruction should mention confirmation')
  assert(confirmedInstruction.includes('Perfectionist'), 'Should reference part name from metadata')
  assert(confirmedInstruction.includes('work emails'), 'Should include observation content')
  console.log('✓ System instruction generation (confirmed) works')

  // Test 2: Generate system instruction for denied insight
  const deniedInstruction = generateSystemInstruction(insightEnvelope, 'denied')
  assert(deniedInstruction.includes('DISAGREED'), 'Denied instruction should mention disagreement')
  assert(deniedInstruction.includes('correction'), 'Should have non-defensive tone')
  assert(!deniedInstruction.includes('curious about the deeper dynamics'), 'Should not use confirmation language')
  console.log('✓ System instruction generation (denied) works')

  // Test 3: Pack chat context
  const context = packChatContext(insightEnvelope, 'confirmed')
  assert(context.systemInstruction, 'Context should have system instruction')
  assert(context.metadata.observationId === 'insight-123', 'Should use sourceId as observationId')
  assert(context.metadata.reaction === 'confirmed', 'Should preserve reaction')
  assert(context.timestamp > 0, 'Should have timestamp')
  console.log('✓ Context packing works')

  // Test 4: Session storage (only in browser environment)
  if (typeof window !== 'undefined' && window.sessionStorage) {
    clearStoredContext() // Clean slate
    
    saveContextToSession(context)
    const retrieved = readAndClearContextFromSession()
    
    assert(retrieved !== null, 'Should retrieve stored context')
    assert(retrieved.metadata.observationId === 'insight-123', 'Should preserve observation ID')
    assert(retrieved.metadata.reaction === 'confirmed', 'Should preserve reaction')
    
    // Should be cleared after reading
    const secondRetrieval = readAndClearContextFromSession()
    assert(secondRetrieval === null, 'Context should be consumed (one-time use)')
    
    console.log('✓ Session storage read/write/clear works')
  } else {
    console.log('⊘ Skipping session storage tests (not in browser environment)')
  }

  // Test 5: TTL expiration
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const expiredContext = {
      ...context,
      timestamp: Date.now() - (11 * 60 * 1000), // 11 minutes ago (expired)
    }
    
    saveContextToSession(expiredContext)
    const expired = readAndClearContextFromSession()
    assert(expired === null, 'Expired context should not be retrieved')
    
    console.log('✓ TTL expiration works')
  }

  // Test 6: Nudge message type
  const nudgeEnvelope: InboxEnvelope = {
    id: 'nudge-1',
    sourceId: 'nudge-123',
    type: 'nudge',
    createdAt: new Date().toISOString(),
    updatedAt: null,
    expiresAt: null,
    readAt: null,
    source: 'network',
    payload: {
      headline: 'Time to check in',
      body: 'You haven\'t checked in today',
    },
  }

  const nudgeInstruction = generateSystemInstruction(nudgeEnvelope, 'confirmed')
  assert(nudgeInstruction.includes('Time to check in'), 'Should include nudge headline')
  assert(nudgeInstruction.includes('haven\'t checked in'), 'Should include nudge body')
  console.log('✓ Nudge message handling works')

  console.log('\n✅ All chat bridge tests passed!')
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

main().catch((error) => {
  console.error('❌ Chat bridge tests failed:', error)
  process.exit(1)
})
