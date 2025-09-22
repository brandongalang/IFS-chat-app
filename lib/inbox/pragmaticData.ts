import type { InboxEnvelope } from '@/types/inbox'

const issuedAt = () => new Date().toISOString()

export function getPragmaticInboxFeed(): InboxEnvelope[] {
  return [
    {
      id: 'pragmatic-insight-spotlight-1',
      type: 'insight_spotlight',
      createdAt: issuedAt(),
      updatedAt: null,
      readAt: null,
      expiresAt: null,
      source: 'network',
      priority: 9,
      tags: ['today', 'reflection'],
      actions: {
        kind: 'boolean',
        positiveLabel: 'Sounds helpful',
        negativeLabel: 'Maybe later',
        allowNotes: true,
      },
      payload: {
        insightId: 'insight-today-highlight',
        title: 'Spotlight: Your calmest check-ins land right after journaling',
        summary:
          'When you journal before the nightly check-in, your parts respond with 25% fewer escalations. Let’s keep that cadence tonight.',
        readingTimeMinutes: 3,
        detail: {
          body: `Over the past 10 sessions, the ones preceded by a short journal entry trended more grounded and required fewer follow-up prompts. Try a 3-minute jot-down to set the tone before tonight's check-in.`,
          sources: [
            { label: 'Check-in timeline', url: '/timeline' },
            { label: 'Parts Explorer', url: '/parts' },
          ],
        },
        cta: {
          label: 'Review insight',
          href: '/insights/insight-today-highlight',
          intent: 'primary',
          helperText: 'Review the full reflection before this evening.',
        },
      },
    },
  ]
}
