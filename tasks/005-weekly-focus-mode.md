# Task 005: Weekly Focus Mode

**Priority**: MEDIUM
**Estimated Impact**: Provides structure without overwhelming
**Estimated Effort**: 1 week

## Overview

Optional weekly focus on a single part, with all features (chat, check-ins, inbox) aligned to explore that part deeply.

## Problem Statement

- Exploring multiple parts simultaneously can be overwhelming
- No clear structure for deep work
- Features feel disconnected

## Proposed Solution

Sunday invitation to focus on one part for the week, with all features supporting that exploration.

## Key Features

### 1. Weekly Focus Selection

```
Sunday Evening Inbox:
"Ready for next week's focus?
Based on recent activity, consider exploring:
• Your Perfectionist (very active lately)
• Your Inner Child (mentioned but unexplored)
[Choose Focus] [Skip This Week]"
```

### 2. Focus-Aware Features

- **Chat**: Knows weekly focus, prompts accordingly
- **Check-ins**: Add focus-specific questions
- **Inbox**: Prioritize observations about focused part
- **Garden**: Highlight focused part and relationships

### 3. Weekly Reflection

```
Sunday Check-in:
"This week with your [Part Name]:
- Key insights: [AI-generated]
- Relationship changes: [tracked]
- Next steps: [suggested]"
```

## Implementation Sketch

```typescript
// Weekly focus tracking
interface WeeklyFocus {
  userId: string;
  partId: string;
  weekStart: Date;
  status: 'active' | 'completed' | 'skipped';
  insights: string[];
  keyMoments: SessionReference[];
}

// Context injection
function getChatSystemPrompt(userId) {
  const focus = await getActiveWeeklyFocus(userId);
  if (focus) {
    return `User is exploring ${focus.partName} this week...`;
  }
}
```

## Success Metrics

- Focus adoption rate
- Completion rate of weekly focuses
- Depth of exploration (evidence/insights per part)
- User satisfaction with structure

## Open Questions

- Mandatory vs optional?
- How to handle urgent parts mid-week?
- Multiple parts in relationship?

## Next Steps

1. Design focus selection UI
2. Modify system prompts
3. Create weekly reflection template
4. Test with power users
