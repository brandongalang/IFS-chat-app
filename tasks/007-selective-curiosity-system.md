# Task 007: Selective Curiosity System

**Priority**: LOW (Follow-up feature after inbox-to-chat)
**Estimated Impact**: Enhances engagement without being pushy
**Estimated Effort**: 1 week

## Overview

Add intelligence to when the assistant proactively follows up on confirmations/denials, showing emotional intelligence about what deserves deeper exploration.

## Problem Statement

- Always following up feels pushy and exhausting
- Never following up misses important moments
- Need balance between availability and insistence

## Proposed Solution

Selective follow-up based on significance signals - the assistant only shows curiosity when something is genuinely noteworthy.

## Trigger Categories

### High Priority (Always Follow Up)

1. **Pattern Breaks**: Unusual behavior for a part
2. **Contradictions**: User disagrees with observation
3. **Breakthroughs**: First-time events
4. **Safety Concerns**: High distress or concerning patterns

### Medium Priority (Sometimes Follow Up)

1. **New Discoveries**: Previously unknown parts
2. **Persistent Patterns**: 3+ days of same behavior
3. **Relationship Dynamics**: New part interactions

### Low Priority (Rarely Follow Up)

1. **Normal Patterns**: Expected behavior
2. **Daily Variations**: Minor changes
3. **Confirmed Knowns**: Already explored topics

## Implementation Sketch

```typescript
interface CuriositySignals {
  isPatternBreak: boolean;
  isContradiction: boolean;
  isBreakthrough: boolean;
  concernLevel: 0 | 1 | 2;
  daysActive: number;
  userEngagementLevel: 'low' | 'medium' | 'high';
}

function generateCuriousFollowUp(observation, signals) {
  if (!shouldTriggerCuriosity(signals)) {
    return null;
  }

  // Generate contextual follow-up
  return llm.generate({
    template: 'curious_follow_up',
    observation,
    signals,
    tone: 'gentle_curiosity',
  });
}
```

## User Control

- Preference setting for curiosity level
- Ability to dismiss follow-ups
- "Not now" always respected

## Success Metrics

- Follow-up engagement rate
- User feedback on timing
- Session depth from follow-ups
- Dismissal rate

## Open Questions

- How to detect "breakthroughs" automatically?
- Should curiosity adapt to user's schedule?
- How to handle multiple triggers same day?

## Dependencies

- Requires inbox-to-chat bridge (Task 001)
- Needs observation significance scoring
- Benefits from user engagement tracking

## Next Steps

1. Implement after inbox-to-chat is stable
2. Start with simple rules (contradictions only)
3. Add intelligence gradually
4. A/B test curiosity levels
