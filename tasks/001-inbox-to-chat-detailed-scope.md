# Task 001: Inbox-to-Chat Bridge - Detailed Scope

**Priority**: HIGHEST
**Estimated Effort**: 1 week
**Target Completion**: End of Week 1

## Core Concept

Enable inbox observations to seamlessly transition into chat conversations through a two-touch flow that respects user agency while eliminating the blank page problem.

## User Flow

### Step 1: Observation Presentation

```
┌─────────────────────────────────────┐
│ 📍 Pattern Noticed                  │
│                                      │
│ Your Perfectionist was particularly │
│ active in work emails yesterday,    │
│ especially with your manager.       │
│                                      │
│ [✓ That's right] [✗ Not quite]     │
└─────────────────────────────────────┘
```

### Step 2A: Confirmation Flow

```
User clicks [✓ That's right]
                ↓
┌─────────────────────────────────────┐
│ ✓ Noted                            │
│                                      │
│ [💬 Explore this in chat]          │
└─────────────────────────────────────┘
```

### Step 2B: Denial Flow

```
User clicks [✗ Not quite]
                ↓
┌─────────────────────────────────────┐
│ Thanks for the correction          │
│                                      │
│ [💬 Tell me what really happened]  │
└─────────────────────────────────────┘
```

### Step 3: Chat Transition

```
User clicks [💬 Explore/Tell me]
                ↓
Navigate to /chat with context
                ↓
Assistant message already present:
"I noticed you confirmed that your Perfectionist
was active in work emails yesterday, especially
with your manager. What do you think that part
was trying to protect you from?"
```

## Technical Implementation

### 1. Database Schema Changes

```sql
-- Add to inbox_observations or metadata
ALTER TABLE inbox_observations ADD COLUMN
  chat_prompt TEXT,
  chat_context JSONB DEFAULT '{}';

-- Track engagement
ALTER TABLE inbox_observations ADD COLUMN
  confirmed_at TIMESTAMP,
  explored_in_chat_at TIMESTAMP;
```

### 2. Inbox Item Structure

```typescript
interface InboxObservation {
  id: string;
  content: string;
  status: 'pending' | 'confirmed' | 'denied' | 'explored';
  chatPrompt?: {
    confirmed: string; // Prompt if user confirms
    denied: string; // Prompt if user denies
    context: {
      observationId: string;
      partId?: string;
      sessionRefs?: string[];
      metadata: Record<string, any>;
    };
  };
}
```

### 3. API Endpoints

#### Update existing `/api/inbox/actions`

```typescript
// POST /api/inbox/actions
{
  action: 'confirm' | 'deny',
  itemId: string
}

// Returns
{
  status: 'confirmed' | 'denied',
  chatAction?: {
    available: boolean,
    label: string,  // "Explore this in chat"
    prompt: string,  // The opening message
    context: object  // Context to pass
  }
}
```

#### New `/api/chat/start-from-inbox`

```typescript
// POST /api/chat/start-from-inbox
{
  observationId: string,
  status: 'confirmed' | 'denied'
}

// Returns
{
  sessionId: string,
  openingMessage: string
}
```

### 4. Frontend Components

#### InboxItem Component Updates

```tsx
function InboxObservationCard({ item }) {
  const [status, setStatus] = useState(item.status);
  const [showChatAction, setShowChatAction] = useState(false);

  const handleConfirm = async () => {
    const result = await confirmObservation(item.id);
    setStatus('confirmed');
    setShowChatAction(true);
  };

  const handleExploreInChat = () => {
    // Store context in session storage
    sessionStorage.setItem(
      'chat_context',
      JSON.stringify({
        fromInbox: true,
        observationId: item.id,
        status: status,
        prompt: item.chatPrompt[status],
      })
    );

    router.push('/chat');
  };

  return (
    <Card>
      <CardContent>{item.content}</CardContent>
      <CardActions>
        {status === 'pending' && (
          <>
            <Button onClick={handleConfirm}>✓ That's right</Button>
            <Button onClick={handleDeny}>✗ Not quite</Button>
          </>
        )}
        {status === 'confirmed' && (
          <>
            <Text>✓ Noted</Text>
            <Button onClick={handleExploreInChat}>💬 Explore this in chat</Button>
          </>
        )}
      </CardActions>
    </Card>
  );
}
```

#### Chat Page Updates

```tsx
function ChatPage() {
  useEffect(() => {
    // Check for inbox context
    const context = sessionStorage.getItem('chat_context');
    if (context && messages.length === 0) {
      const { prompt, observationId } = JSON.parse(context);

      // Start conversation with assistant message
      addAssistantMessage(prompt, {
        metadata: { fromInbox: true, observationId },
      });

      // Clear context
      sessionStorage.removeItem('chat_context');

      // Track engagement
      trackInboxToChatConversion(observationId);
    }
  }, []);

  // Rest of chat implementation...
}
```

### 5. Prompt Generation

```typescript
// When creating observations
async function generateObservationWithPrompts(observation) {
  const prompts = await llm.generate({
    template: `
      Observation: ${observation.content}
      
      Generate two chat opening prompts:
      1. If user confirms this observation
      2. If user denies this observation
      
      Make them curious and specific, referencing the observation directly.
    `,
  });

  return {
    ...observation,
    chatPrompt: {
      confirmed: prompts.confirmed,
      denied: prompts.denied,
    },
  };
}
```

## Success Metrics

### Primary Metrics

- **Inbox → Chat Conversion Rate**: % of observations that lead to chat
- **Two-Touch Completion**: % who complete both touches
- **Session Depth**: Average messages in inbox-initiated vs regular sessions

### Secondary Metrics

- **Time to Engagement**: How quickly users go from inbox to chat
- **Confirmation Rate**: % of observations confirmed vs denied
- **Return Rate**: Do inbox-initiated sessions lead to more sessions?

### Tracking Implementation

```typescript
// Analytics events
track('inbox_observation_viewed', { observationId });
track('inbox_observation_confirmed', { observationId });
track('inbox_observation_denied', { observationId });
track('inbox_to_chat_clicked', { observationId, status });
track('chat_session_started_from_inbox', { observationId });
```

## MVP Scope (Week 1)

### Must Have

- ✅ Two-touch flow (confirm → explore)
- ✅ Context passing to chat
- ✅ Assistant-initiated message
- ✅ Basic tracking

### Nice to Have (Week 2)

- 🔄 Different prompts for confirm vs deny
- 🔄 Rich context (references, evidence)
- 🔄 Selective curiosity (Task 007)

### Out of Scope (Future)

- ❌ Inline responses in inbox
- ❌ Multi-observation bundling
- ❌ Voice responses

## Development Steps

### Day 1-2: Backend

1. Update database schema
2. Modify observation generation to include prompts
3. Update inbox API endpoints
4. Create chat context endpoint

### Day 3-4: Frontend

1. Update InboxItem component
2. Add chat context handling
3. Update chat page initialization
4. Add navigation flow

### Day 5: Integration & Testing

1. End-to-end testing
2. Analytics implementation
3. Error handling
4. Edge cases

### Day 6-7: Polish & Deploy

1. UI/UX refinements
2. Performance optimization
3. Staging deployment
4. Production release

## Risk Mitigation

### Risk 1: Prompt Quality

**Mitigation**: Start with template-based prompts, iterate based on engagement

### Risk 2: Context Loss

**Mitigation**: Use both sessionStorage and URL params for redundancy

### Risk 3: User Confusion

**Mitigation**: Clear labeling, optional onboarding tooltip

## Questions to Resolve

1. **Prompt Style**: How conversational vs clinical?
2. **Context Depth**: How much history to reference?
3. **Timing**: Should chat action expire?
4. **Mobile**: How does flow work on mobile?

## Next Steps

1. Review scope with team
2. Finalize prompt templates
3. Create UI mockups
4. Begin backend implementation
