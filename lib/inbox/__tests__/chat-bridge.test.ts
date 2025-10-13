/**
 * Tests for inbox-to-chat bridge module
 * 
 * Covers context generation, storage, retrieval, and TTL handling
 */

import test, { describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import {
  generateSystemInstruction,
  packChatContext,
  saveContextToSession,
  readAndClearContextFromSession,
  clearStoredContext,
  generateOpeningMessage,
} from '../chat-bridge'
import type { InsightSpotlightEnvelope, NudgeEnvelope } from '@/types/inbox'

// Mock sessionStorage
const mockSessionStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => Object.keys(store)[index] || null,
  }
})()

// Mock both window and sessionStorage globally
Object.defineProperty(global, 'window', {
  value: {
    sessionStorage: mockSessionStorage,
  },
  writable: true,
  configurable: true,
})

Object.defineProperty(global, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
  configurable: true,
})

describe('chat-bridge', () => {
  beforeEach(() => {
    mockSessionStorage.clear()
  })

  describe('generateSystemInstruction', () => {
    test('generates confirmed instruction for insight spotlight', () => {
      const observation: InsightSpotlightEnvelope = {
        id: 'env-1',
        sourceId: 'obs-1',
        type: 'insight_spotlight',
        source: 'network',
        createdAt: '2025-01-01',
        updatedAt: null,
        expiresAt: null,
        readAt: null,
        payload: {
          summary: 'Your inner critic is active when discussing work',
          insightId: 'insight-1',
          title: 'Inner Critic Pattern',
          evidence: [
            { id: 'evidence-1', type: 'session_quote', quote: 'I feel anxious', summary: 'Anxiety about work' },
          ],
        },
        metadata: {
          partName: 'Inner Critic',
        },
      }

      const instruction = generateSystemInstruction(observation, 'confirmed')

      assert.match(instruction, /CONFIRMED/)
      assert.match(instruction, /Your inner critic is active when discussing work/)
      assert.match(instruction, /Part involved: Inner Critic/)
      assert.match(instruction, /Explore in chat/)
      assert.match(instruction, /Evidence: Anxiety about work/)
    })

    test('generates denied instruction for nudge', () => {
      const observation: NudgeEnvelope = {
        id: 'env-2',
        sourceId: 'obs-2',
        type: 'nudge',
        source: 'network', updatedAt: null, expiresAt: null, readAt: null,
        createdAt: '2025-01-01',
        payload: {
          headline: 'Time for a check-in?',
          body: 'You haven\'t checked in for 3 days',
        },
        metadata: {},
      }

      const instruction = generateSystemInstruction(observation, 'denied')

      assert.match(instruction, /DISAGREED/)
      assert.match(instruction, /Time for a check-in\?/)
      assert.match(instruction, /You haven't checked in for 3 days/)
      assert.match(instruction, /Tell me what really happened/)
      assert.match(instruction, /learning opportunity/)
    })

    test('handles observations without evidence', () => {
      const observation: InsightSpotlightEnvelope = {
        id: 'env-3',
        sourceId: 'obs-3',
        type: 'insight_spotlight',
        source: 'network',
        createdAt: '2025-01-01',
        updatedAt: null,
        expiresAt: null,
        readAt: null,
        payload: {
          summary: 'Pattern detected',
          insightId: 'insight-3',
          title: 'Pattern Detection'
        },
        metadata: {},
      }

      const instruction = generateSystemInstruction(observation, 'confirmed')

      assert.match(instruction, /Pattern detected/)
      assert.doesNotMatch(instruction, /Evidence:/)
      assert.doesNotMatch(instruction, /Part involved:/)
    })
  })

  describe('packChatContext', () => {
    test('packages observation and reaction into context', () => {
      const observation: InsightSpotlightEnvelope = {
        id: 'env-1',
        sourceId: 'obs-1',
        type: 'insight_spotlight',
        source: 'network',
        createdAt: '2025-01-01',
        updatedAt: null,
        expiresAt: null,
        readAt: null,
        payload: {
          summary: 'Test insight',
          insightId: 'insight-1',
          title: 'Test Insight Title'
        },
        metadata: {},
      }

      const context = packChatContext(observation, 'confirmed')

      assert.ok(context.systemInstruction)
      assert.ok(context.metadata)
      assert.ok(context.timestamp)
      assert.equal(context.metadata.observationId, 'obs-1')
      assert.equal(context.metadata.reaction, 'confirmed')
      assert.equal(context.metadata.observation, observation)
      assert.equal(typeof context.timestamp, 'number')
    })
  })

  describe('sessionStorage operations', () => {
    test('saves and retrieves context successfully', () => {
      const observation: InsightSpotlightEnvelope = {
        id: 'env-1',
        sourceId: 'obs-1',
        type: 'insight_spotlight',
        source: 'network',
        createdAt: '2025-01-01',
        updatedAt: null,
        expiresAt: null,
        readAt: null,
        payload: {
          summary: 'Test insight',
          insightId: 'insight-1',
          title: 'Test Insight Title'
        },
        metadata: {},
      }

      const context = packChatContext(observation, 'confirmed')
      saveContextToSession(context)

      const retrieved = readAndClearContextFromSession()
      assert.notEqual(retrieved, null)
      assert.equal(retrieved?.metadata.observationId, 'obs-1')
      assert.equal(retrieved?.metadata.reaction, 'confirmed')
    })

    test('clears context after reading', () => {
      const observation: InsightSpotlightEnvelope = {
        id: 'env-1',
        sourceId: 'obs-1',
        type: 'insight_spotlight',
        source: 'network',
        createdAt: '2025-01-01',
        updatedAt: null,
        expiresAt: null,
        readAt: null,
        payload: {
          summary: 'Test insight',
          insightId: 'insight-1',
          title: 'Test Insight Title'
        },
        metadata: {},
      }

      const context = packChatContext(observation, 'confirmed')
      saveContextToSession(context)

      const first = readAndClearContextFromSession()
      assert.notEqual(first, null)

      const second = readAndClearContextFromSession()
      assert.equal(second, null)
    })

    test('rejects expired context', () => {
      const observation: InsightSpotlightEnvelope = {
        id: 'env-1',
        sourceId: 'obs-1',
        type: 'insight_spotlight',
        source: 'network',
        createdAt: '2025-01-01',
        updatedAt: null,
        expiresAt: null,
        readAt: null,
        payload: {
          summary: 'Test insight',
          insightId: 'insight-1',
          title: 'Test Insight Title'
        },
        metadata: {},
      }

      const context = packChatContext(observation, 'confirmed')
      // Set timestamp to 11 minutes ago (exceeds 10 minute TTL)
      context.timestamp = Date.now() - 11 * 60 * 1000

      saveContextToSession(context)

      const retrieved = readAndClearContextFromSession()
      assert.equal(retrieved, null)
    })

    test('clears context explicitly', () => {
      const observation: InsightSpotlightEnvelope = {
        id: 'env-1',
        sourceId: 'obs-1',
        type: 'insight_spotlight',
        source: 'network',
        createdAt: '2025-01-01',
        updatedAt: null,
        expiresAt: null,
        readAt: null,
        payload: {
          summary: 'Test insight',
          insightId: 'insight-1',
          title: 'Test Insight Title'
        },
        metadata: {},
      }

      const context = packChatContext(observation, 'confirmed')
      saveContextToSession(context)

      clearStoredContext()

      const retrieved = readAndClearContextFromSession()
      assert.equal(retrieved, null)
    })

    test('handles invalid context gracefully', () => {
      mockSessionStorage.setItem('inbox_chat_context', 'invalid json')

      const retrieved = readAndClearContextFromSession()
      assert.equal(retrieved, null)
    })

    test('handles missing fields gracefully', () => {
      mockSessionStorage.setItem('inbox_chat_context', JSON.stringify({
        metadata: {},
        // Missing systemInstruction and timestamp
      }))

      const retrieved = readAndClearContextFromSession()
      assert.equal(retrieved, null)
    })
  })

  describe('generateOpeningMessage', () => {
    test('generates confirmed message for insight', () => {
      const observation: InsightSpotlightEnvelope = {
        id: 'env-1',
        sourceId: 'obs-1',
        type: 'insight_spotlight',
        source: 'network',
        createdAt: '2025-01-01',
        updatedAt: null,
        expiresAt: null,
        readAt: null,
        payload: {
          summary: 'Your inner critic is active',
          insightId: 'insight-1',
          title: 'Inner Critic Pattern'
        },
        metadata: {
          partName: 'Inner Critic',
        },
      }

      const message = generateOpeningMessage(observation, 'confirmed')

      assert.match(message, /Thanks for confirming/)
      assert.match(message, /Your inner critic is active/)
      assert.match(message, /Inner Critic/)
      assert.match(message, /What feels most relevant/)
    })

    test('generates denied message', () => {
      const observation: NudgeEnvelope = {
        id: 'env-2',
        sourceId: 'obs-2',
        type: 'nudge',
        source: 'network',
        createdAt: '2025-01-01',
        updatedAt: null,
        expiresAt: null,
        readAt: null,
        payload: {
          headline: 'Check-in reminder',
          body: 'Overdue',
        },
        metadata: {},
      }

      const message = generateOpeningMessage(observation, 'denied')

      assert.match(message, /didn't quite fit/)
      assert.match(message, /what was actually happening/)
    })

    test('handles missing part name', () => {
      const observation: InsightSpotlightEnvelope = {
        id: 'env-1',
        sourceId: 'obs-1',
        type: 'insight_spotlight',
        source: 'network',
        createdAt: '2025-01-01',
        updatedAt: null,
        expiresAt: null,
        readAt: null,
        payload: {
          summary: 'Pattern detected',
          insightId: 'insight-1',
          title: 'Test Insight'
        },
        metadata: {},
      }

      const message = generateOpeningMessage(observation, 'confirmed')

      assert.doesNotMatch(message, /\(sounds like this involves/)
      assert.match(message, /Pattern detected/)
    })
  })
})
