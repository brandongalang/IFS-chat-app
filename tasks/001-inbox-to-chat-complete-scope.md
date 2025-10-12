# Task 001: Inbox-to-Chat Bridge - Complete Scope & Context

**Priority**: HIGHEST\
**Estimated Effort**: 1 week\
**Target Completion**: End of Week 1

## Executive Summary

Enable inbox observations to seamlessly transition into chat conversations through a two-touch flow that respects user agency while eliminating the blank page problem. The assistant will generate contextual opening messages based on rich context about what the user just confirmed/denied.

## Core Problem Being Solved

### Current State Problems

- **Blank Page Problem**: Users open chat but don't know what to talk about

- **Disconnected Features**: Inbox observations don't lead to action

- **Static Experience**: Generic "what feels unresolved..." message for everyone

- **Cognitive Load**: User must generate conversation topics from scratch

### Desired State

- **Zero Friction Start**: Conversations begin from specific observations

- **Connected Experience**: Inbox naturally flows into deeper exploration

- **Dynamic & Contextual**: Every conversation starts appropriately

- **Assistant-Led**: Agent initiates based on user's confirmation/denial

## Current Implementation Context

### Key Files to Modify

#### Inbox System

- `/app/api/inbox/route.ts` - Main inbox feed endpoint

- `/app/api/inbox/events/route.ts` - Inbox event tracking

- `/app/api/inbox/actions/route.ts` - Handle confirm/deny actions (TO CREATE)

- `/components/inbox/InboxShelf.tsx` - Main inbox UI component

- `/app/_shared/hooks/useInboxFeed.ts` - Inbox feed hook

- `/lib/data/inbox-items.ts` - Inbox item mapping and data functions

- `/lib/data/inbox-actions.ts` - Inbox action handlers

- `/app/_shared/types/inbox.ts` - TypeScript types for inbox

#### Chat System

- `/app/chat/page.tsx` - Chat page component

- `/components/ethereal/EtherealChat.tsx` - Main chat UI (contains static message to remove)

- `/app/api/chat/route.ts` - Chat API endpoint

- `/app/api/chat/logic.ts` - Chat business logic

- `/app/_shared/hooks/useChat.ts` - Chat hook

- `/mastra/agents/ifs-chat.ts` - Mastra chat agent configuration

#### Database

- `inbox_observations` table - Stores observations

- `inbox_message_events` table - Tracks user interactions

- `sessions` table - Chat sessions

- `messages` table - Chat messages

### Current Inbox Data Flow

```typescript
// Current InboxEnvelope structure (from types/inbox.ts)
interface InboxEnvelopeBase {
  id: string;
  sourceId: string;
  type: InboxMessageType; // 'insight_spotlight' | 'nudge' | 'cta' | 'notification'
  createdAt: string;
  source: InboxEnvelopeSource; // 'network' | 'fallback' | 'supabase' | 'edge'
  actions?: InboxActionSchema; // Currently scale4 or acknowledge
  metadata?: Record;
}
```

`// Current action handling (from InboxShelf.tsx)`\
`const handleQuickAction = (envelope: InboxEnvelope, action: InboxQuickActionValue) => {`\
`markAsRead(envelope.id);`\
`// Currently just submits action, doesn't transition to chat`\
`submitAction(envelope.id, action, notes);`\
`};`

### Current Chat Initialization

```typescript
// From EtherealChat.tsx (line 131-138)
useEffect(() => {
if (authLoading || needsAuth) return;
if (seededRef.current) return;
if ((messages?.length ?? 0) === 0) {
seededRef.current = true;
// This static message needs to be replaced
addAssistantMessage('what feels unresolved or undefined for you right now?', {
persist: true,
id: 'ethereal-welcome',
});
}
}, [messages?.length, addAssistantMessage, needsAuth, authLoading]);
```

## Design Philosophy

### Key Principles

1. **Two-Touch Simplicity**: Confirm/Deny → Explore (not overwhelming)

2. **User Agency**: Never forced into chat, always optional

3. **Context-Rich**: Agent knows full context of what user reacted to

4. **Natural Flow**: Feels like continuation, not new conversation

5. **Intelligence Over Scripts**: Let agent generate responses, don't pre-write

### What We're NOT Doing

- ❌ Inline responses in inbox (adds complexity)

- ❌ Fake user messages (inauthentic)

- ❌ Pre-scripted responses (too rigid)

- ❌ Always-on curiosity (too pushy)

- ❌ Complex multi-step flows (cognitive burden)

## Detailed Implementation Plan

### 1. Extend Inbox Item Structure

```typescript
// Add to inbox_observations table
ALTER TABLE inbox_observations ADD COLUMN
chat_prompt_context JSONB DEFAULT '{}';
```

`// Extend InboxEnvelope type in types/inbox.ts`\
`interface InboxEnvelopeBase {`\
`// ... existing fields ...`\
`chatPromptContext?: {`\
`confirmPrompt: string;`\
`denyPrompt: string;`\
`systemInstruction: string;`\
`metadata: {`\
`partId?: string;`\
`partName?: string;`\
`evidence?: string[];`\
`relatedSessions?: string[];`\
`};`\
`};`\
`}`

### 2. Modify Inbox Action Flow

```typescript
// Update InboxShelf.tsx handleQuickAction
const handleQuickAction = async (envelope: InboxEnvelope, action: InboxQuickActionValue) => {
markAsRead(envelope.id);
```

`if (action === 'agree_strong' || action === 'agree') {`\
`setConfirmedEnvelope(envelope);`\
`setShowChatPrompt(true);`\
`} else if (action === 'disagree' || action === 'disagree_strong') {`\
`setDeniedEnvelope(envelope);`\
`setShowChatPrompt(true);`\
`}`

`// Track the action`\
`await submitAction(envelope.id, action);`\
`};`

`// Add chat transition handler`\
`const handleExploreInChat = (envelope: InboxEnvelope, reaction: 'confirmed' | 'denied') => {`\
`const context = {`\
`systemInstruction: generateSystemInstruction(envelope, reaction),`\
`metadata: {`\
`observationId: envelope.sourceId,`\
`reaction,`\
`observation: envelope,`\
`},`\
`};`

`sessionStorage.setItem('inbox_chat_context', JSON.stringify(context));`\
`router.push('/chat');`\
`};`

### 3. Update Chat Initialization

```typescript
// Replace static message in EtherealChat.tsx
useEffect(() => {
if (authLoading || needsAuth) return;
if (seededRef.current) return;
if ((messages?.length ?? 0) === 0) {
seededRef.current = true;
```

```
// Check for inbox context
const inboxContext = sessionStorage.getItem('inbox_chat_context');
if (inboxContext) {
  const context = JSON.parse(inboxContext);
```

`// Pass context to agent for first message generation`\
`// This will trigger the agent to generate an appropriate opening`\
`generateAssistantMessage({`\
`systemContext: context.systemInstruction,`\
`metadata: context.metadata,`\
`});`

`// Track conversion`\
`trackInboxToChatConversion(context.metadata.observationId);`

`sessionStorage.removeItem('inbox_chat_context');`\
`} else {`\
`// Regular chat session - let agent generate contextual greeting`\
`generateAssistantMessage({`\
`systemContext: User is starting a new chat session. Current time: ${new Date().toLocaleString()} Recent activity: Check user's recent patterns and check-ins. Generate a warm, contextual greeting that invites them to share what's on their mind.,`\
`});`\
`}`

`}`\
`}, [messages?.length, generateAssistantMessage, needsAuth, authLoading]);`

### 4. System Instruction Generation

```typescript
// New function in lib/inbox/chat-bridge.ts
export function generateSystemInstruction(
observation: InboxEnvelope,
reaction: 'confirmed' | 'denied'
): string {
const isInsight = observation.type === 'insight_spotlight';
const content = isInsight
? (observation as InsightSpotlightEnvelope).payload.summary
: observation.metadata?.content || 'the observation';
```

`if (reaction === 'confirmed') {`\
`return The user just reviewed and CONFIRMED the following observation from their inbox:`

`"${content}"`

`They clicked "Explore in chat" indicating they want to discuss this pattern further.`

`${observation.metadata?.partName ? Part involved: ${observation.metadata.partName} : ''}`\
`${observation.metadata?.evidence ? Evidence: ${observation.metadata.evidence.join(', ')} : ''}`

`Start by acknowledging their confirmation and explore what might be happening with this pattern.`\
`Be curious about the deeper dynamics at play. Reference specific details from the observation.; } else { return The user just reviewed and DISAGREED with the following observation from their inbox:`

`"${content}"`

`They clicked "Tell me what really happened" indicating the observation wasn't accurate.`

`Start by thanking them for the correction and explore what was actually happening for them.`\
`Be curious and non-defensive about getting it right. This is a learning opportunity.;`\
`}`\
`}`

### 5. Update Chat API to Handle Context

```typescript
// Modify app/api/chat/route.ts
export async function POST(req: NextRequest) {
const payload = await req.json();
const { messages, profile, systemContext } = payload;
```

`// If systemContext provided (from inbox), pass to agent`\
`if (systemContext) {`\
`// Inject context into agent's system prompt`\
`const enhancedProfile = {`\
`...profile,`\
`currentContext: systemContext,`\
`};`

```
return handleAgentStream(messages, enhancedProfile);
```

`}`

`// Regular flow`\
`return handleAgentStream(messages, profile);`\
`}`

### 6. Analytics & Tracking

```typescript
// New analytics events to track
interface InboxToChatEvents {
inbox_observation_viewed: { observationId: string; type: string };
inbox_observation_confirmed: { observationId: string };
inbox_observation_denied: { observationId: string };
inbox_chat_cta_shown: { observationId: string; reaction: string };
inbox_chat_cta_clicked: { observationId: string; reaction: string };
chat_started_from_inbox: { observationId: string; reaction: string };
inbox_chat_session_depth: {
observationId: string;
messageCount: number;
duration: number;
};
}
```

`// Add tracking in appropriate places`\
`emitInboxEvent('inbox_observation_confirmed', { observationId });`\
`emitInboxEvent('inbox_chat_cta_clicked', { observationId, reaction });`

## User Flow Examples

### Example 1: Confirmed Observation

1. User sees: "Your Perfectionist was active in work emails"

2. Clicks: \[✓ That's right\]

3. Sees: "✓ Noted" + \[💬 Explore this in chat\]

4. Clicks: \[💬 Explore this in chat\]

5. Chat opens with agent saying: "I see you confirmed that your Perfectionist was really active in those work emails. That's interesting - what do you notice happening when you're writing to your manager?"

### Example 2: Denied Observation

1. User sees: "Your Critic seemed quiet today"

2. Clicks: \[✗ Not quite\]

3. Sees: "Thanks for the correction" + \[💬 Tell me what really happened\]

4. Clicks: \[💬 Tell me what really happened\]

5. Chat opens with agent saying: "Thanks for letting me know that wasn't quite right about your Critic being quiet. What was actually happening with that part today?"

## Success Metrics

### Primary KPIs

1. **Inbox → Chat Conversion Rate**: Target 30%+ of observations lead to chat

2. **Session Depth**: Inbox-initiated sessions should be 50% longer

3. **User Retention**: Users who use this feature should have 2x retention

### Secondary Metrics

- Time between observation and chat (shorter = better)

- Confirmation vs denial rates

- Which observation types lead to most engagement

- Drop-off between confirm and explore

## Implementation Checklist

### Backend Tasks

- [ ] Add chat_prompt_context to inbox_observations table

- [ ] Create system instruction generator function

- [ ] Update inbox action endpoints to return chat context

- [ ] Modify chat API to accept system context

- [ ] Add analytics tracking endpoints

- [ ] Create conversion tracking table

### Frontend Tasks

- [ ] Remove static welcome message from EtherealChat

- [ ] Add dynamic message generation for regular sessions

- [ ] Update InboxShelf component with two-touch flow

- [ ] Add "Explore in chat" CTA after confirmation/denial

- [ ] Implement context passing via sessionStorage

- [ ] Add navigation from inbox to chat

- [ ] Track all analytics events

### Agent/Prompt Tasks

- [ ] Update Mastra agent to handle inbox context

- [ ] Test various observation → chat transitions

- [ ] Refine system instruction templates

- [ ] Ensure natural conversation flow

### Testing Tasks

- [ ] End-to-end flow testing

- [ ] Context preservation testing

- [ ] Analytics verification

- [ ] Error handling (lost context, etc.)

- [ ] Mobile experience testing

## Risk Mitigation

### Risk: Context Loss

**Mitigation**: Store context in both sessionStorage and as URL param backup

### Risk: Awkward Agent Responses

**Mitigation**: Extensive testing of system instructions, A/B test different approaches

### Risk: User Confusion

**Mitigation**: Clear CTA copy, optional tooltip on first use

### Risk: Over-engagement

**Mitigation**: Track fatigue signals, implement cooldowns if needed

## Future Enhancements (Not in MVP)

### Phase 2: Selective Curiosity (Task 007)

- Some confirmations trigger immediate follow-up

- Based on significance signals (breakthroughs, concerns, patterns)

- "This seems important - want to explore now?"

### Phase 3: Bundled Observations

- Multiple related observations can be explored together

- "You have 3 observations about your Perfectionist - explore them all?"

### Phase 4: Smart Timing

- Time-sensitive prompts based on user's schedule

- "You have a meeting in 1 hour - want to check in with that Protector part?"

## Questions for Implementation

1. Should denied observations have different CTA text?

2. How long should context remain valid? (timeout?)

3. Should we show preview of what agent will discuss?

4. Mobile-specific considerations?

5. Should some observations bypass confirmation?

---

This document represents the complete scope and context for the Inbox-to-Chat Bridge feature, including all current implementation details and file locations.