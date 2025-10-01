import type { InboxEnvelope } from '@/types/inbox'

export const mockInboxEnvelopes: InboxEnvelope[] = [
  {
    id: 'mock-insight-spotlight-1',
    type: 'insight_spotlight',
    createdAt: new Date().toISOString(),
    updatedAt: null,
    readAt: null,
    expiresAt: null,
    source: 'fallback',
    priority: 10,
    tags: ['sample', 'dev'],
    actions: {
      kind: 'scale4',
      agreeStrongLabel: 'Agree a lot',
      agreeLabel: 'Agree a little',
      disagreeLabel: 'Disagree a little',
      disagreeStrongLabel: 'Disagree a lot',
      helperText: 'How true does this feel right now?',
      allowNotes: true,
    },
    payload: {
      insightId: 'mock-insight-1',
      title: 'Your parts are most talkative after evening reflections',
      summary:
        'In the past week you logged the most breakthroughs when reflecting between 8–9pm. Matching that rhythm could improve tomorrow’s check-in.',
      readingTimeMinutes: 2,
      detail: {
        body: `Recent reflection logs show longer, calmer responses after sunset. Keeping a gentle ritual—like dimming lights or revisiting your planner—may help sustain that gain.`,
        sources: [
          { label: 'Reflection log • 7 entries', url: '/journal' },
          { label: 'Insight archive', url: '/insights' },
        ],
      },
      cta: {
        label: 'Open insight',
        href: '/insights/mock-insight-1',
        intent: 'primary',
      },
    },
  },
]

export function getMockInboxEnvelopes(): InboxEnvelope[] {
  return mockInboxEnvelopes.map((entry) => ({
    ...entry,
    createdAt: entry.createdAt ?? new Date().toISOString(),
  }))
}
