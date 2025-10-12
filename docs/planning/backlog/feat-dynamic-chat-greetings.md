# Dynamic Chat Greetings (Future Feature)

**Status**: Placeholder / Needs Design  
**Priority**: TBD  
**Related**: [Inbox-to-Chat Bridge](/docs/planning/next/feat-inbox-to-chat-bridge.md)

## Problem Statement

When users navigate directly to chat (not from inbox), they currently see an empty canvas. While this respects user agency and avoids crowding out their intent, there may be opportunities to make the experience feel more contextually aware and engaging.

## Open Questions

### User Intent vs. Agent Initiative
- **Core tension**: When should the agent lead vs. follow?
- If user seeks out chat intentionally, what does an empty canvas communicate?
- What's the right balance between "giving space" and "feeling prepared"?

### Contextual Awareness
- Should the agent have access to recent activity (check-ins, insights, parts interactions)?
- If yes, what's the appropriate way to surface that context?
- Should context inform the greeting without directing the conversation?

### Potential Approaches

#### Option A: Minimal Context Display
- Show recent activity indicators without agent commentary
- Let user see their "state" without the agent interpreting it
- Example: "Recent: Check-in completed today, 2 new insights"

#### Option B: Contextual Greeting (Non-Directive)
- Agent acknowledges context but doesn't steer
- Example: "I noticed you checked in this morning. I'm here whenever you're ready to talk."
- Risk: Still feels like agent is taking space

#### Option C: "Work on Something" Mode
- Separate feature/entry point for agent-guided exploration
- Direct chat remains empty canvas
- User explicitly chooses when they want agent to lead
- Most respects user agency

#### Option D: Status Quo+
- Keep empty canvas
- Add subtle UI hints about recent activity
- No agent message at all

## Design Considerations

### What We Know
1. **Inbox-to-Chat works**: When user comes from inbox with explicit context, agent-first message makes sense
2. **User agency matters**: Users seeking chat have intent; crowding that out feels wrong
3. **Context is valuable**: Recent activity could inform better conversations

### What We Need to Learn
1. Do users feel "lost" with empty canvas, or does it feel respectful?
2. Would context awareness feel helpful or intrusive?
3. Is "Work on Something" mode a better solution for guided exploration?

## Related Work

- **Inbox-to-Chat Bridge** ([feat-inbox-to-chat-bridge.md](/docs/planning/next/feat-inbox-to-chat-bridge.md)): Demonstrates successful agent-first messaging *with explicit user intent*
- **Session Management**: How do we track user intent across different entry points?

## Next Steps (Before Implementation)

1. **User Research**: Test empty canvas vs. contextual greetings with real users
2. **Define "Work on Something" Flow**: Separate feature spec for guided mode
3. **Analytics**: Instrument direct-to-chat behavior to understand patterns
4. **Prototype**: A/B test different approaches with small cohort

## Scope Boundary

**This feature is explicitly OUT OF SCOPE for Inbox-to-Chat Bridge implementation.**

The bridge implementation will:
- ✅ Support agent-first messages from inbox context
- ✅ Remove static welcome message
- ✅ Show empty canvas for direct chat starts
- ❌ NOT implement any dynamic greeting for direct starts

## Notes

**Date**: 2025-10-12  
**Author**: Product discussion during inbox-to-chat-bridge planning  
**Key Insight**: "I don't want the agent to crowd out the user" - need intentional design, not default behavior
