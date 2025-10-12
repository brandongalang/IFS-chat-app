# Task 001: Inbox-to-Chat Bridge

**Priority**: HIGH
**Estimated Impact**: Transforms user engagement by eliminating blank page problem
**Estimated Effort**: 1 week

## Overview

Enable inbox items to initiate chat conversations with specific prompts, allowing the assistant to start sessions proactively rather than waiting for user input.

## Problem Statement

- Users face cognitive load when starting chat sessions
- "What should I talk about?" is a barrier to engagement
- Valuable observations in inbox don't translate to action

## Proposed Solution

Add ability for inbox items to contain chat prompts that, when clicked, open chat with assistant-initiated conversation.

## Key Features

1. **Inbox Action Type**: New `start_chat` action for inbox items
2. **Context Transfer**: Pass observation context to chat
3. **Pre-filled Opening**: Assistant message already sent when chat opens
4. **Action Tracking**: Mark inbox items as "explored" when used

## Implementation Sketch

```typescript
// Inbox item structure
{
  type: "chat_starter",
  title: "Explore yesterday's pattern",
  preview: "Your Perfectionist was very active...",
  action: {
    type: "start_chat",
    opening_message: "Yesterday you mentioned...",
    context: { /* reference data */ }
  }
}
```

## User Flow

1. User sees inbox item with "Explore in chat" button
2. Clicks button
3. Navigates to chat with assistant message already present
4. Conversation begins naturally from specific context

## Technical Requirements

- Modify inbox item schema
- Add chat route parameter handling
- Update inbox UI components
- Track engagement metrics

## Success Metrics

- Click-through rate from inbox to chat
- Session length for prompted vs unprompted chats
- User retention improvement

## Open Questions

- Should all inbox items be chat-startable?
- How much context to transfer?
- Archive or hide used prompts?

## Next Steps

1. Design detailed inbox item schema
2. Prototype UI flow
3. Test with subset of users
