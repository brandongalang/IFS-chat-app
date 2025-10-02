import assert from 'node:assert/strict'

import type { ObservationCandidate } from '@/lib/inbox/observation-schema'
import type { ObservationTraceResolvers } from '@/lib/inbox/observation-engine'

async function main() {
  const modulePath = '@/lib/inbox/observation-engine?test=' + Date.now()
  const { buildObservationTrace } = await import(modulePath)

  const resolvers: ObservationTraceResolvers = {
    readMarkdown: async ({ path }) => {
      if (path === 'missing.md') {
        throw new Error('File not found')
      }
      return {
        path,
        offset: 0,
        nextOffset: null,
        data: `Snippet from ${path}`,
        hasMore: false,
      }
    },
    getSessionDetail: async ({ sessionId }) => {
      return {
        sessionId,
        startedAt: '2024-09-30T10:00:00Z',
        endedAt: null,
        summary: `Summary for ${sessionId}`,
        messages: [
          { role: 'assistant', content: 'Guidance offered', timestamp: '2024-09-30T10:05:00Z' },
          { role: 'user', content: 'Reflection shared', timestamp: '2024-09-30T10:10:00Z' },
        ],
        nextPage: null,
      }
    },
    getCheckInDetail: async ({ checkInId }) => {
      return {
        checkInId,
        type: 'morning',
        date: '2024-09-29',
        intention: 'Settle before meetings',
        reflection: 'Felt calmer after breathing',
        gratitude: 'Supportive friend',
        partsData: null,
        createdAt: '2024-09-29T07:30:00Z',
        updatedAt: '2024-09-29T07:30:00Z',
      }
    },
  }

  const candidate: ObservationCandidate = {
    title: 'Breathing habits surfaced in recent sessions',
    summary: 'Breathing routines appear consistently before calmer reflections.',
    inference: 'A daily breathing primer may be stabilizing morning check-ins.',
    evidence: [
      {
        type: 'markdown',
        source: 'markdown:overview.md#L4',
        summary: 'Overview note about breathing routines',
      },
      {
        type: 'session',
        sessionId: 'session-1',
        summary: 'Session mention of breathing practice',
      },
      {
        type: 'session',
        sessionId: 'session-1',
        summary: 'Duplicate session evidence should be deduped',
      },
      {
        type: 'check-in',
        checkInId: 'check-1',
        summary: 'Check-in reflection captured',
      },
      {
        type: 'markdown',
        metadata: { markdownPath: 'parts/guardian/profile.md' },
        summary: 'Guardian part profile snippet',
      },
      {
        type: 'markdown',
        metadata: { markdownPath: 'missing.md' },
        summary: 'Missing markdown should surface error',
      },
    ],
  }

  const trace = await buildObservationTrace('user-123', candidate, resolvers)

  assert(trace, 'Expected trace to be generated')
  assert.equal(trace?.markdown?.length, 3)
  const missingEntry = trace?.markdown?.find((item) => item.path === 'missing.md')
  assert(missingEntry)
  assert.equal(missingEntry?.error, 'File not found')

  assert.equal(trace?.sessions?.length, 1)
  const sessionTrace = trace?.sessions?.[0]
  assert.equal(sessionTrace?.sessionId, 'session-1')
  assert.equal(sessionTrace?.messageCount, 2)
  assert.equal(sessionTrace?.hasMore, false)

  assert.equal(trace?.checkIns?.length, 1)
  const checkTrace = trace?.checkIns?.[0]
  assert.equal(checkTrace?.checkInId, 'check-1')
  assert.equal(checkTrace?.type, 'morning')
}

main().catch((error) => {
  console.error('inbox-observation-trace tests failed:', error)
  process.exit(1)
})
