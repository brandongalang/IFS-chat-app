# Task 003: Dynamic IFS Programs

**Priority**: MEDIUM-HIGH
**Estimated Impact**: Creates structure and commitment for deep work
**Estimated Effort**: 2 weeks

## Overview

LLM-generated multi-day programs for exploring specific parts, providing structured journeys with daily prompts and exercises.

## Problem Statement

- Open-ended exploration can feel directionless
- Users don't know how to systematically work with parts
- No sense of progression or completion

## Proposed Solution

Generate personalized 14-21 day programs for deep work with individual parts.

## Program Structure Example

```
"21 Days with Your Inner Critic"
Week 1: Discovery & Observation
- Day 1-3: Notice when it speaks
- Day 4-7: Track triggers and patterns

Week 2: Understanding
- Day 8-10: Explore its fears
- Day 11-14: Discover what it's protecting

Week 3: Integration
- Day 15-18: Develop new relationship
- Day 19-21: Practice self-compassion
```

## Key Features

1. **LLM Generation**: Personalized based on user's history with part
2. **Daily Prompts**: Specific questions/exercises for each day
3. **Progress Tracking**: Visual progress through program
4. **Flexible Pacing**: Can pause/resume
5. **Completion Certificate**: Celebration at end

## Implementation Sketch

```typescript
// Program generation
async function generateProgram(userId, partId) {
  const context = await getUserPartContext(userId, partId);
  const program = await llm.generate({
    template: 'ifs_program',
    duration: 21,
    part: context,
  });
  return program;
}

// Daily delivery
function getTodaysProgramContent(userId) {
  const activeProgram = await getActiveProgram(userId);
  return activeProgram.days[activeProgram.currentDay];
}
```

## Success Metrics

- Program completion rates
- Depth of engagement per day
- Part evolution during programs
- User retention during programs

## Open Questions

- Fixed vs flexible duration?
- Multiple concurrent programs?
- Prerequisites for starting?
- How to handle missed days?

## Next Steps

1. Design program templates
2. Create LLM prompt engineering
3. Build progress tracking UI
4. Test with pilot users
