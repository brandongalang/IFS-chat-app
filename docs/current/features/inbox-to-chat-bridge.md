# Inbox-to-Chat Bridge

**Status**: Implemented
**Last Updated**: 2025-10-17
**Related PRs**: #308, #309, #310

## Overview

The Inbox-to-Chat Bridge enables seamless transitions from inbox observations (insights and nudges) into contextual chat conversations. When users react to an observation in their inbox, they can click a CTA to explore it further in chat, with the agent receiving full context about the observation and the user's reaction.

## User Flow

### 1. Observation in Inbox
User views an insight spotlight or nudge in their inbox feed.

### 2. Quick Action
User confirms or denies the observation:
- **Confirm**: Acknowledges the pattern is accurate
- **Deny**: Indicates the observation doesn't fit

### 3. Explore in Chat
After taking a quick action, user sees CTAs:
- **"💬 Explore in chat"** - Navigate to chat with context
- **"→ That's enough"** - Dismiss and continue

### 4. Contextual Chat Session
When user clicks "Explore in chat":
- Context is packed and stored in sessionStorage
- User navigates to `/chat`
- Chat component detects context on mount
- Agent receives system instruction with observation details
- Agent generates contextual opening message

## Architecture

### Backend Components

#### `lib/inbox/chat-bridge.ts`
Core module for context packaging and session storage:

**Key Functions**:
- `generateSystemInstruction()` - Creates agent instructions based on observation and reaction
- `packChatContext()` - Packages observation into chat context object
- `saveContextToSession()` - Persists context to sessionStorage
- `readAndClearContextFromSession()` - Retrieves and clears one-time context
- `clearStoredContext()` - Manual cleanup utility
- `generateOpeningMessage()` - Template-based fallback for opening messages (MVP)

**Data Types**:
```typescript
interface InboxChatContext {
  systemInstruction: string
  metadata: {
    observationId: string
    reaction: InboxChatReaction
    observation: InboxEnvelope
  }
  timestamp: number
}

type InboxChatReaction = 'confirmed' | 'denied'
```

**Storage**:
- Uses sessionStorage with 10-minute TTL
- One-time consumption pattern (cleared after read)
- Automatic expiration validation

#### `app/api/chat/route.ts` & `logic.ts`
Chat API enhanced to accept system context:

**Changes**:
- Added `systemContext` parameter to chat endpoint
- Passes context through to agent prompt generation
- Allows empty message content when system context provided

#### `mastra/agents/ifs_agent_prompt.ts`
Agent prompt generator includes inbox context section:

**Behavior**:
- When systemContext present, prepends to agent instructions
- Agent responds appropriately to confirmed/denied observations
- References specific observation details in responses

### Frontend Components

#### `app/_shared/hooks/useChat.ts`
Chat hook extended to support system context:

**Changes**:
- `sendMessage()` accepts optional `systemContext` parameter
- Allows empty message with context (triggers agent response)
- Passes context through SDK request body

#### `components/ethereal/EtherealChat.tsx`
Chat UI detects and consumes inbox context:

**Behavior**:
- On mount, reads context from sessionStorage
- If context found, triggers agent response with system instructions
- Agent generates contextual opening instead of generic greeting
- Emits `chat_started_from_inbox` analytics event
- **PR #310 refinements**: Removed unused `generateOpeningMessage` import (agent now uses systemContext directly), removed unused `addAssistantMessage` variable

#### Inbox Cards
`components/inbox/cards/InsightSpotlightCard.tsx` and `NudgeCard.tsx`:

**Changes**:
- Show actioned state after quick action (muted appearance + badge)
- Display CTAs after action: "Explore in chat" and "That's enough"
- Track last action in card metadata

#### `components/inbox/InboxShelf.tsx`
Orchestrates the bridge workflow:

**Behavior**:
- Calls `packChatContext()` when user clicks "Explore in chat"
- Saves context to sessionStorage
- Navigates to `/chat` route
- Uses a shared `emitEnvelopeEvent` helper to ensure analytics payloads stay aligned for open, dismiss, and CTA click events.
- Card remains visible after action (not dismissed)
- Trailhead refresh (2025-10-17): Inbox shelf now renders as a warm parchment card with preview badges and Trailhead typography so the bridge matches the redesigned Today feed.

#### `app/_shared/hooks/useInboxFeed.ts`
Manages inbox feed state:

**Changes**:
- Tracks action state for each observation
- Persists lastAction in feed metadata
- Supports "actioned" visual state

## System Instructions

### For Confirmed Observations

```
The user just reviewed and CONFIRMED the following observation from their inbox:

"[Observation content]"

They clicked "Explore in chat" indicating they want to discuss this pattern further.

Part involved: [Part name if applicable]
Evidence: [Evidence items if applicable]

Start by acknowledging their confirmation and explore what might be happening
with this pattern. Be curious about the deeper dynamics at play. Reference
specific details from the observation.
```

### For Denied Observations

```
The user just reviewed and DISAGREED with the following observation from their inbox:

"[Observation content]"

They clicked "Tell me what really happened" indicating the observation wasn't accurate.

Start by thanking them for the correction and explore what was actually happening
for them. Be curious and non-defensive about getting it right. This is a learning
opportunity.
```

## Code Paths

### Context Packaging
1. User clicks "Explore in chat" → `InboxShelf.handleExplorInChat()`
2. `packChatContext(observation, reaction)` → creates context object
3. `saveContextToSession(context)` → stores in sessionStorage
4. `router.push('/chat')` → navigates to chat

### Context Consumption
1. `EtherealChat` mounts → `useEffect` runs
2. `readAndClearContextFromSession()` → retrieves and clears context
3. Validates TTL and structure
4. `sendMessage('', systemContext)` → triggers agent with context
5. Agent generates opening response
6. Analytics event: `chat_started_from_inbox`

### Agent Processing
1. Chat API receives request with `systemContext`
2. `handleAgentStream(systemContext)` → passes to agent
3. Agent prompt includes inbox context section
4. Agent generates contextual response
5. Response streams back to UI

## Analytics Events

### `chat_started_from_inbox`
Fired when user navigates from inbox to chat with context.

**Properties**:
- `observation_id` - Source inbox observation ID
- `observation_type` - Type of observation (insight_spotlight, nudge)
- `reaction` - User's reaction (confirmed, denied)
- `context_age_ms` - Age of context when consumed (for TTL monitoring)

## Database Schema

### Action Tracking
Migration adds columns to inbox tables for tracking user actions:

```sql
action_value TEXT  -- 'confirmed' | 'denied'
action_timestamp TIMESTAMPTZ  -- When action occurred
```

**Tables Updated**:
- `inbox_insights`
- `inbox_nudges`

## Error Handling

### Context Storage Failures
- Graceful degradation: logs warning, continues without context
- User can still access chat normally
- No error shown to user

### Context Retrieval Failures
- Expired context (>10min): logged, returns null
- Invalid structure: logged, returns null
- Missing context: normal chat session starts

### SessionStorage Unavailable
- Server-side rendering: early return, no errors
- Browser without sessionStorage: logs warning, continues

## Security Considerations

### Context TTL
- 10-minute expiration prevents stale context
- One-time consumption pattern (cleared after read)
- No persistent storage of sensitive observation data

### Input Validation
- Context structure validated before use
- Observation IDs checked against user's inbox
- Agent instructions sanitized (no user-controlled prompts)

## Testing

### Unit Tests
`lib/inbox/__tests__/chat-bridge.test.ts`:
- System instruction generation (confirmed/denied)
- Context packaging
- SessionStorage operations
- TTL validation
- Opening message generation
- **Code quality (PR #310)**: Removed unused type imports, improved type safety by removing `any` casts

### Integration Testing (TODO)
- End-to-end flow from inbox to chat
- Context passing through navigation
- Agent response generation
- Analytics event tracking

### Manual Testing Checklist
- [ ] Confirm observation → "Explore in chat" → agent responds appropriately
- [ ] Deny observation → "Tell me what happened" → agent asks for correction
- [ ] Context expires after 10 minutes
- [ ] Multiple rapid navigations handle context correctly
- [ ] Works on mobile browsers
- [ ] Analytics events fire correctly

## Future Enhancements

### Dynamic Opening Messages
Replace `generateOpeningMessage()` template approach with server-side generation using the agent. This would:
- Generate truly contextual responses
- Handle complex observation types better
- Support personalization based on user history

### Swipe Gestures (Mobile)
Add swipe interactions on cards:
- Swipe left: Quick deny
- Swipe right: Quick confirm
- Swipe up: Explore in chat

### Multi-Observation Context
Allow user to select multiple observations to explore together:
- Batch context packaging
- Agent receives multiple observation contexts
- Finds patterns across observations

### Context History
Track context usage for:
- Analytics on conversion from inbox to chat
- Identifying high-value observations
- Understanding user exploration patterns

## Migration Notes

### From Static Welcome Message
Previous behavior:
- Chat always showed generic greeting
- No connection to inbox observations
- User had to manually describe what they wanted to discuss

New behavior:
- Empty sessions start with inbox context if present
- Agent opens with specific observation reference
- Seamless transition from inbox to chat

### Breaking Changes
None - this is a new feature that adds functionality without removing existing behavior.

## Related Documentation

- [Inbox System](./inbox/index.md) - Overview of inbox observation system
- [Chat Agent](./chat.md) - Chat agent implementation details
- [Inbox Observation Job](../operations/runbooks/inbox-observation-job.md) - How observations are generated
