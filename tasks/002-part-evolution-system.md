# Task 002: Part Evolution System

**Priority**: HIGH
**Estimated Impact**: Makes progress visible and celebrated
**Estimated Effort**: 3-4 days

## Overview

Track and visualize the evolution of parts through stages, creating visible progress markers and celebration moments.

## Problem Statement

- Users can't see their progress with parts
- No sense of advancement or achievement
- Parts feel static rather than evolving

## Proposed Solution

Add evolution stages to parts with visual badges and transition celebrations.

## Evolution Stages

1. **Discovered** 🥚 - Just identified
2. **Emerging** 🐣 - Starting to understand
3. **Understanding** 🐥 - Clear picture forming
4. **Integrated** 🦅 - Healthy relationship established

## Key Features

1. **Automatic Progression**: Based on evidence count, time, and interactions
2. **Visual Badges**: Show in Parts Garden and chat
3. **Transition Celebrations**: Inbox notifications when parts evolve
4. **Progress Overview**: See all parts' evolution status

## Implementation Sketch

```typescript
// Add to parts table
evolution_stage: 'discovered' | 'emerging' | 'understanding' | 'integrated'
evolved_at: timestamp[]  // Track transition times

// Progression logic
function checkEvolution(part) {
  if (evidenceCount > 10 && daysSinceDiscovery > 7) {
    return 'understanding';
  }
  // etc...
}
```

## Success Metrics

- User engagement with evolved parts
- Retention correlation with evolution progress
- Celebration moment engagement

## Open Questions

- Automatic vs manual progression?
- Regression possible?
- Different criteria per part type?

## Next Steps

1. Define progression criteria
2. Design badge UI
3. Create celebration templates
