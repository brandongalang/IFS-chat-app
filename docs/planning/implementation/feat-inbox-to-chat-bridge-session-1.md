# Inbox-to-Chat Bridge - Implementation Log (Session 1)

**Feature**: Inbox-to-Chat Bridge  
**Branch**: `feature/inbox-to-chat-bridge`  
**Started**: 2025-10-12  
**Plan Reference**: [/docs/planning/next/feat-inbox-to-chat-bridge.md](/docs/planning/next/feat-inbox-to-chat-bridge.md)

## Session Overview

Implementing the inbox-to-chat bridge feature to enable seamless transitions from inbox observations into contextual chat conversations.

## Key Decisions

### 1. System Instructions Approach ✓
- **Decision**: Use system instructions to provide context, not hidden user messages
- **Rationale**: Cleaner conversation history, more flexible for future features
- **Alternative Considered**: Hidden user message approach (rejected)

### 2. Direct Chat Start Behavior ✓
- **Decision**: Empty canvas (no agent message)
- **Rationale**: Respects user agency when they intentionally seek chat
- **Related**: Created placeholder doc for future dynamic greetings feature
- **Doc**: [/docs/planning/backlog/feat-dynamic-chat-greetings.md](/docs/planning/backlog/feat-dynamic-chat-greetings.md)

### 3. Context Storage ✓
- **Decision**: Use sessionStorage for MVP
- **Rationale**: Simple, fast, sufficient for single-page navigation
- **Future**: Could upgrade to server-side if needed
- **Timeout**: 10 minutes

### 4. Card Persistence ✓
- **Decision**: Keep actioned cards visible with CTAs until dismissed
- **Rationale**: User might not engage immediately; allow coming back later

## Implementation Checklist

### Phase 1: Foundation (Day 1)
- [x] Sync with remote main (fast-forward)
- [x] Create feature branch
- [x] Create placeholder doc for dynamic greetings
- [x] Create implementation log (this file)
- [ ] Database migration for action tracking
- [ ] Update TypeScript types
- [ ] Create chat bridge module
- [ ] Update inbox action endpoint

### Phase 2: Frontend State (Day 1-2)
- [ ] Update useInboxFeed hook for actioned state
- [ ] Modify InboxShelf for CTA handling
- [ ] Add handleExploreInChat navigation
- [ ] Wire analytics events

### Phase 3: UI Components (Day 2)
- [ ] Update InsightSpotlightCard with actioned state
- [ ] Update NudgeCard with actioned state
- [ ] Create SwipeableCard component
- [ ] Implement visual feedback for swipes
- [ ] Add CTA buttons (Explore / Dismiss)

### Phase 4: Chat Integration (Day 2-3)
- [ ] Remove static welcome message from EtherealChat
- [ ] Add context detection logic
- [ ] Wire system instruction to agent
- [ ] Handle empty canvas for direct starts
- [ ] Add error handling for invalid context

### Phase 5: Testing & Polish (Day 3)
- [ ] Unit tests for chat-bridge module
- [ ] Unit tests for action persistence
- [ ] Integration tests for full flow
- [ ] E2E test: Confirm → Explore flow
- [ ] E2E test: Deny → Explore flow
- [ ] E2E test: Direct chat (empty canvas)
- [ ] Mobile swipe testing
- [ ] Analytics verification

### Phase 6: Documentation & PR
- [ ] Update this implementation log
- [ ] Update feature docs
- [ ] Update .docmap.json if needed
- [ ] Run docs CI check
- [ ] Create PR with detailed description
- [ ] Request reviews

## Technical Notes

### Session Context Shape
```typescript
{
  systemInstruction: string,
  metadata: {
    observationId: string,
    reaction: 'confirmed' | 'denied',
    observation: InboxEnvelope
  }
}
```

### Key Files Modified
- `supabase/migrations/20251012_inbox_observation_actions.sql` (new)
- `app/_shared/types/inbox.ts`
- `lib/inbox/chat-bridge.ts` (new)
- `lib/data/inbox-actions.ts`
- `app/api/inbox/[id]/action/route.ts`
- `app/_shared/hooks/useInboxFeed.ts`
- `components/inbox/InboxShelf.tsx`
- `components/inbox/cards/InsightSpotlightCard.tsx`
- `components/inbox/cards/NudgeCard.tsx`
- `components/inbox/cards/SwipeableCard.tsx` (new)
- `components/ethereal/EtherealChat.tsx`
- `lib/analytics/inbox.ts`

## Open Questions

- [ ] Does the agent API support passing systemInstruction for first message?
- [ ] What's the exact signature for `addAssistantMessage` or equivalent?
- [ ] Are there existing analytics helpers we should reuse?
- [ ] What's the current database schema for `inbox_observations`?

## Blockers

None currently.

## Next Session

Continue with database migration and TypeScript types (Step 1 of main plan).

## Analytics Events to Track

1. `inbox_action_taken` - When user confirms/denies
2. `inbox_chat_cta_shown` - When Explore button appears
3. `inbox_chat_cta_clicked` - When user clicks Explore
4. `chat_started_from_inbox` - When chat loads with context

## Progress Notes

**2025-10-12 23:15 UTC**: 
- ✅ Synced with remote (3 commits fast-forwarded)
- ✅ Created feature branch
- ✅ Created placeholder doc for dynamic greetings
- ✅ Created this implementation log
- 🚧 Starting database migration next

---

_This log will be updated throughout implementation to track progress and decisions._
