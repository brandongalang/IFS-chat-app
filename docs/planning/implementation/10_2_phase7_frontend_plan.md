# Phase 7: Frontend Updates for Unified Inbox Types

**Date:** 2025-11-08  
**Status:** Planning  
**Scope:** Update frontend to handle all 6 unified inbox item types

## Current Architecture

**Data Flow:**
```
Database (inbox_items)
  ├─ 6 unified types: session_summary, nudge, follow_up, observation, question, pattern
  └─ Stored as: type, content{title, summary, body, inference}, evidence[], metadata{}

API (/api/inbox)
  ├─ Query inbox_items_view
  └─ Map via mapInboxItemToEnvelope()

Frontend Envelopes (InboxEnvelope)
  ├─ insight_spotlight: title, summary, body (detail), evidence, sources, cta
  ├─ nudge: headline, body, cta
  ├─ notification: title, body, link
  └─ cta: title, description, action

Components (InboxCardRegistry)
  ├─ InsightSpotlightCard (renders insight_spotlight)
  ├─ NudgeCard (renders nudge)
  ├─ NotificationCard (renders notification)
  └─ CallToActionCard (renders cta)
```

## Problem: Type Mismatch

**Unified Types (Backend):**
- session_summary: title, summary
- nudge: title, summary, body
- follow_up: title, summary, body
- observation: title, summary, inference, evidence[]
- question: title, summary, inference
- pattern: title, summary, inference, evidence[]

**Envelope Types (Frontend):**
- insight_spotlight: Complex with detail, sources, evidence
- nudge: Simple headline + body
- notification: title + body + link
- cta: Not applicable

## Phase 7 Implementation Strategy

### Option A (Recommended): Extended Envelope Types
- Extend existing envelope types to support all 6 unified types
- Keep backward compatible with existing cards
- Minimal frontend component changes

**Pros:**
- Reuse existing card components
- Simple mapping logic
- Lower risk of breaking changes

**Cons:**
- Envelope types become less focused
- May need new cards eventually

### Option B: New Unified Envelope Type
- Create single "UnifiedInboxEnvelope" with all fields
- Create new "UnifiedInboxCard" component
- Replace all old types

**Pros:**
- Cleaner architecture long-term
- One component to rule them all
- Future-proof

**Cons:**
- Breaking changes
- More rewrite required

## Recommended Approach: Option A Extended

### Step 1: Extend Envelope Types

Add new envelope types for the new unified types:

```typescript
export type ObservationEnvelope = InboxEnvelopeBase & {
  type: 'observation'
  payload: ObservationMessage  // {title, summary, inference, evidence}
}

export type QuestionEnvelope = InboxEnvelopeBase & {
  type: 'question'
  payload: QuestionMessage     // {title, summary, inference}
}

export type PatternEnvelope = InboxEnvelopeBase & {
  type: 'pattern'
  payload: PatternMessage      // {title, summary, inference, evidence}
}

export type SessionSummaryEnvelope = InboxEnvelopeBase & {
  type: 'session_summary'
  payload: SessionSummaryMessage  // {title, summary}
}

export type FollowUpEnvelope = InboxEnvelopeBase & {
  type: 'follow_up'
  payload: FollowUpMessage    // {title, summary, body}
}

// Update union type
export type InboxEnvelope = 
  | InsightSpotlightEnvelope
  | NudgeEnvelope
  | CallToActionEnvelope
  | NotificationEnvelope
  | ObservationEnvelope
  | QuestionEnvelope
  | PatternEnvelope
  | SessionSummaryEnvelope
  | FollowUpEnvelope
```

### Step 2: Update Mapping Logic

Extend mapInboxItemToEnvelope() to handle all 6 unified types:

```typescript
const resolveEnvelopeType = (item: InboxItem, metadata): InboxMessageType => {
  const sourceType = item.sourceType
  const metaKind = toTrimmedString(metadata.kind)
  const unifiedType = toTrimmedString(metadata.type)

  // Map unified types to envelopes
  if (unifiedType === 'session_summary') return 'session_summary'
  if (unifiedType === 'nudge') return 'nudge'
  if (unifiedType === 'follow_up') return 'follow_up'
  if (unifiedType === 'observation') return 'observation'
  if (unifiedType === 'question') return 'question'
  if (unifiedType === 'pattern') return 'pattern'

  // Fallback for old insights
  if (sourceType === 'insight') return 'insight_spotlight'
  
  // ... rest of logic
}
```

### Step 3: Update Card Registry

Add new card components or extend existing ones:

```typescript
// Option A: Reuse insight_spotlight for observation/pattern/question
// Option B: Create minimal new cards for each type
```

### Step 4: Create Simple Cards (MVP)

For observation, question, pattern: Create minimal cards that reuse InsightSpotlightCard structure:

```typescript
export function ObservationCard({ envelope, ...props }) {
  // Reuse InsightSpotlightCard with observation-specific styling
  return (
    <div className="observation-card">
      <InsightSpotlightCard 
        envelope={{
          ...envelope,
          type: 'insight_spotlight', // Reuse existing
          payload: {
            ...envelope.payload,
            // Map inference to body
          }
        }}
        {...props}
      />
    </div>
  )
}
```

## Files to Modify

1. **app/_shared/types/inbox.ts**
   - Add new envelope types (ObservationEnvelope, QuestionEnvelope, PatternEnvelope, etc.)
   - Update InboxMessageType enum
   - Add new message payload types (ObservationMessage, etc.)

2. **lib/data/inbox-items.ts**
   - Update resolveEnvelopeType() for 6 unified types
   - Add toObservationPayload(), toQuestionPayload(), toPatternPayload()
   - Update mapInboxItemToEnvelope() switch statement

3. **components/inbox/InboxCardRegistry.tsx**
   - Add cases for observation, question, pattern, session_summary, follow_up
   - Render appropriate cards for each type

4. **components/inbox/InboxShelf.tsx**
   - Update renderEnvelopeDetail() switch for new types
   - Add detail renderers for each type

5. **components/inbox/cards/**
   - Create new card components OR
   - Extend existing cards to handle new types

## Minimal MVP Approach

To finish Phase 7 quickly:

1. **Extend envelope types** (app/_shared/types/inbox.ts)
2. **Update mapping** (lib/data/inbox-items.ts)
3. **Add registry cases** (InboxCardRegistry.tsx)
4. **Reuse components** (map all 6 types to existing insight_spotlight card)
5. **Add detail renderers** (InboxShelf.tsx)

**Result:** All 6 types display but with basic styling (reuse insight_spotlight card)

**Future enhancement:** Create type-specific cards with proper styling

## Acceptance Criteria

✅ All 6 unified types have envelope representations  
✅ Mapping function handles all 6 types  
✅ Card registry can render all 6 types  
✅ Detail view works for all 6 types  
✅ No UI crashes for new types  
✅ typecheck passes  
✅ lint passes

## Time Estimate

- Extend types: 30 min
- Update mapping: 30 min
- Update registry + shelves: 30 min
- Component updates/reuse: 30 min
- Testing: 30 min
- **Total: 2.5-3 hours**

## Post-MVP Enhancements

After core MVP:
1. Create specific cards for observation/pattern (with evidence display)
2. Add type-specific icons/colors
3. Improve evidence rendering
4. Add filtering by type
