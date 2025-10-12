# Task 006: Journey Narrative View

**Priority**: LOW-MEDIUM
**Estimated Impact**: Makes progress emotionally meaningful
**Estimated Effort**: 2 weeks

## Overview

Transform user's IFS journey into a narrative format, presenting their work as an unfolding story rather than clinical data.

## Problem Statement

- Progress feels abstract and clinical
- No emotional connection to journey
- Hard to see the "big picture" of transformation

## Proposed Solution

Create a "Story Mode" view that presents the user's journey as chapters and narrative arcs.

## Key Features

### 1. Chapter Generation

```
Chapter 1: "Meeting the Perfectionist" (Week 1-2)
- First noticed in work emails
- Discovered protecting younger self
- Beginning to understand its role

Chapter 2: "The Critic Emerges" (Week 3-4)
- Appeared during self-reflection
- Realized connection to Perfectionist
- Explored their alliance
```

### 2. Narrative Elements

- **Story Arc**: Beginning → Conflict → Understanding → Integration
- **Character Development**: Parts as characters with backstories
- **Plot Points**: Breakthrough moments as story beats
- **Themes**: Recurring patterns as narrative themes

### 3. Visual Timeline

- Scrollable timeline of chapters
- Key moments marked with icons
- Relationships shown as story connections
- Progress as narrative progression

## Implementation Sketch

```typescript
// Narrative generation
async function generateChapter(userId, startDate, endDate) {
  const events = await getJourneyEvents(userId, startDate, endDate);

  return llm.generateNarrative({
    events,
    style: 'compassionate storytelling',
    perspective: 'second person',
    tone: 'hopeful and curious',
  });
}

// Story structure
interface StoryChapter {
  title: string;
  period: DateRange;
  summary: string;
  keyMoments: Moment[];
  charactersIntroduced: Part[];
  themes: string[];
}
```

## Success Metrics

- Time spent in story view
- Sharing/export of stories
- Emotional resonance (user feedback)
- Return visits to past chapters

## Open Questions

- AI-generated vs templated narratives?
- User editing of their story?
- Privacy of story sharing?
- How often to generate?

## Next Steps

1. Design narrative templates
2. Create story UI/timeline
3. Test narrative generation
4. Gather user feedback on tone
