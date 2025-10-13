# Inbox-to-Chat Bridge Implementation Plan

## Current State Analysis

### Inbox System

- **Location**: `components/inbox/InboxShelf.tsx`
- **Current Flow**:
  1. User sees inbox cards (observations/insights)
  2. User can take quick actions: `agree_strong`, `agree`, `disagree`, `disagree_strong`, `ack`
  3. Actions are handled by `handleQuickAction` which calls `submitAction`
  4. Actions are persisted via `/api/inbox/[id]/action/route.ts`
  5. User can optionally add notes to their reaction
  6. After action, the card is marked as read and the action is recorded

### Chat System

- **Location**: `components/ethereal/EtherealChat.tsx`
- **Current Flow**:
  1. Chat initializes with a static welcome message: "what feels unresolved or undefined for you right now?"
  2. This message is added via `addAssistantMessage` in a `useEffect` when messages array is empty
  3. Chat uses `useChat` hook which manages session state and message persistence
  4. Messages are sent to `/api/chat` endpoint which invokes the Mastra IFS agent

### Key Findings

- ✅ Inbox already has action handling infrastructure
- ✅ Chat has `addAssistantMessage` method that can generate dynamic first messages
- ✅ Both systems have clear separation of concerns
- ⚠️ No current connection between inbox actions and chat initialization
- ⚠️ Static welcome message needs to be replaced with context-aware generation

## Future State Design

### User Flow

1. User sees observation in inbox
2. User clicks confirm/deny (existing flow)
3. **NEW**: After action submission, show CTA button
4. **NEW**: CTA click stores context and navigates to chat
5. **NEW**: Chat detects context and generates contextual opening

### Technical Flow

```
InboxShelf.tsx
    ↓ handleQuickAction()
    ↓ submitAction()
    ↓ [NEW] Show CTA after success
    ↓ [NEW] handleExploreInChat()
    ↓ Store context in sessionStorage
    ↓ Navigate to /chat

EtherealChat.tsx
    ↓ useEffect checks sessionStorage
    ↓ [NEW] If context exists, pass to agent
    ↓ Agent generates contextual opening
    ↓ Clear sessionStorage context
```

## Implementation Steps

### Step 1: Extend Inbox Action Response

**File**: `components/inbox/InboxShelf.tsx`

Add state for showing CTA after action:

```typescript
const [actionedEnvelopes, setActionedEnvelopes] = useState<Map<string, 'confirmed' | 'denied'>>(
  new Map()
);
```

### Step 2: Modify Quick Action Handler

**File**: `components/inbox/InboxShelf.tsx`

Update `handleQuickAction` to track confirmation/denial:

```typescript
const handleQuickAction = async (envelope: InboxEnvelope, action: InboxQuickActionValue) => {
  markAsRead(envelope.id);

  // Existing action handling
  await completeQuickAction(envelope, action);

  // NEW: Track action type
  if (action === 'agree_strong' || action === 'agree') {
    setActionedEnvelopes((prev) => new Map(prev).set(envelope.id, 'confirmed'));
  } else if (action === 'disagree' || action === 'disagree_strong') {
    setActionedEnvelopes((prev) => new Map(prev).set(envelope.id, 'denied'));
  }
};
```

### Step 3: Add CTA Component

**File**: `components/inbox/InboxCardRegistry.tsx` (or new component)

Add CTA rendering after action:

```typescript
interface PostActionCTAProps {
  envelope: InboxEnvelope
  reaction: 'confirmed' | 'denied'
  onExplore: () => void
}

function PostActionCTA({ envelope, reaction, onExplore }: PostActionCTAProps) {
  const ctaText = reaction === 'confirmed'
    ? "💬 Explore this in chat"
    : "💬 Tell me what really happened"

  return (
    <Button
      onClick={onExplore}
      variant="ghost"
      className="mt-2 w-full"
    >
      {ctaText}
    </Button>
  )
}
```

### Step 4: Create Context Bridge

**File**: `lib/inbox/chat-bridge.ts` (new file)

```typescript
export interface InboxChatContext {
  observationId: string;
  reaction: 'confirmed' | 'denied';
  observation: InboxEnvelope;
  timestamp: string;
}

export function storeInboxContext(context: InboxChatContext) {
  sessionStorage.setItem(
    'inbox_chat_context',
    JSON.stringify({
      ...context,
      timestamp: new Date().toISOString(),
    })
  );
}

export function retrieveInboxContext(): InboxChatContext | null {
  const stored = sessionStorage.getItem('inbox_chat_context');
  if (!stored) return null;

  try {
    const context = JSON.parse(stored);
    // Check if context is less than 5 minutes old
    const age = Date.now() - new Date(context.timestamp).getTime();
    if (age > 5 * 60 * 1000) {
      sessionStorage.removeItem('inbox_chat_context');
      return null;
    }
    return context;
  } catch {
    return null;
  }
}

export function generateSystemInstruction(
  observation: InboxEnvelope,
  reaction: 'confirmed' | 'denied'
): string {
  // Extract observation content based on type
  const content =
    observation.type === 'insight_spotlight'
      ? (observation as InsightSpotlightEnvelope).payload.summary
      : observation.metadata?.content || 'the observation';

  if (reaction === 'confirmed') {
    return `The user just CONFIRMED this observation from their inbox:
"${content}"

They clicked "Explore in chat" indicating interest in discussing this pattern.
${observation.metadata?.partName ? `Part involved: ${observation.metadata.partName}` : ''}

Start by acknowledging their confirmation and explore what's happening with this pattern. 
Be curious about the deeper dynamics. Reference specific details from the observation.`;
  } else {
    return `The user just DISAGREED with this observation from their inbox:
"${content}"

They clicked "Tell me what really happened" indicating the observation wasn't accurate.

Start by thanking them for the correction and explore what was actually happening. 
Be curious and non-defensive about getting it right. This is a learning opportunity.`;
  }
}
```

### Step 5: Add Navigation Handler

**File**: `components/inbox/InboxShelf.tsx`

```typescript
import { useRouter } from 'next/navigation';
import { storeInboxContext } from '@/lib/inbox/chat-bridge';

// In component:
const router = useRouter();

const handleExploreInChat = (envelope: InboxEnvelope) => {
  const reaction = actionedEnvelopes.get(envelope.id);
  if (!reaction) return;

  storeInboxContext({
    observationId: envelope.sourceId,
    reaction,
    observation: envelope,
    timestamp: new Date().toISOString(),
  });

  // Track analytics
  emitInboxEvent('inbox_chat_cta_clicked', {
    envelopeId: envelope.id,
    reaction,
    metadata: { variant: activeVariant },
  });

  router.push('/chat');
};
```

### Step 6: Update Chat Initialization

**File**: `components/ethereal/EtherealChat.tsx`

Replace the static message initialization:

```typescript
import { retrieveInboxContext, generateSystemInstruction } from '@/lib/inbox/chat-bridge';

// Replace existing seeded message effect
useEffect(() => {
  if (authLoading || needsAuth) return;
  if (seededRef.current) return;
  if ((messages?.length ?? 0) === 0) {
    seededRef.current = true;

    // Check for inbox context
    const inboxContext = retrieveInboxContext();

    if (inboxContext) {
      // Generate contextual opening from inbox
      const systemInstruction = generateSystemInstruction(
        inboxContext.observation,
        inboxContext.reaction
      );

      // Send to agent with context
      sendMessage('', {
        systemContext: systemInstruction,
        metadata: {
          source: 'inbox',
          observationId: inboxContext.observationId,
          reaction: inboxContext.reaction,
        },
      });

      // Clear context after use
      sessionStorage.removeItem('inbox_chat_context');

      // Track conversion
      emitInboxEvent('chat_started_from_inbox', {
        observationId: inboxContext.observationId,
        reaction: inboxContext.reaction,
      });
    } else {
      // Regular chat session - keep existing welcome
      addAssistantMessage('what feels unresolved or undefined for you right now?', {
        persist: true,
        id: 'ethereal-welcome',
      });
    }
  }
}, [messages?.length, addAssistantMessage, needsAuth, authLoading, sendMessage]);
```

### Step 7: Update Chat API to Accept Context

**File**: `app/api/chat/route.ts`

Modify to accept system context:

```typescript
// In the request handler, check for systemContext
const { messages, systemContext, metadata } = await request.json();

// Pass to agent if provided
if (systemContext) {
  // Prepend system context to the agent's system prompt
  // This depends on how Mastra agent is configured
}
```

## Testing Plan

### Manual Testing Flow

1. Load inbox with observations
2. Confirm an observation → Verify CTA appears
3. Click CTA → Verify navigation to chat
4. Verify chat opens with contextual message about the observation
5. Test denial flow → Verify different CTA and opening message
6. Test timeout → Wait 5+ minutes, verify fallback to regular welcome

### Edge Cases to Test

- Multiple inbox tabs open
- Quick navigation away and back
- Chat already has active session
- Context expires (5 minute timeout)
- User manually navigates to chat without inbox context

## Analytics Events

Track the full funnel:

```typescript
// Existing
'inbox_observation_viewed';
'inbox_observation_confirmed';
'inbox_observation_denied';

// New
'inbox_chat_cta_shown'; // CTA displayed after action
'inbox_chat_cta_clicked'; // User clicked CTA
'chat_started_from_inbox'; // Chat session initiated with context
'inbox_chat_first_response'; // User sent first message in inbox-initiated chat
```

## Rollback Plan

Feature can be disabled by:

1. Not showing CTA buttons (feature flag in InboxShelf)
2. Chat falls back to static message if no context
3. All changes are additive, existing flows remain intact

## Success Metrics

Primary KPIs:

- **CTA Click Rate**: % of actions that lead to CTA click (target: 30%)
- **Chat Engagement**: Messages per inbox-initiated session vs regular (target: +50%)
- **Retention**: Users who use this feature have higher 7-day retention

## Next Steps

1. Implement Step 1-3: Basic CTA display after actions
2. Implement Step 4-5: Context bridge and navigation
3. Implement Step 6-7: Chat context handling
4. Add analytics tracking
5. Test edge cases
6. Monitor metrics for 1 week
7. Iterate based on data
