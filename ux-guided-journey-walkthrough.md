# The Guided Journey: Detailed User Walkthrough

## Week 1: Sarah Discovers Her Perfectionist

### Sunday Evening - The Weekly Invitation

**Current State**: Sarah opens the app after onboarding last week
**Screen**: Home/Today page

```
┌─────────────────────────────────────┐
│  This Week's Focus                  │
│                                      │
│  Ready to explore a part of you?    │
│                                      │
│  Based on your recent sessions,     │
│  I noticed your Perfectionist part  │
│  has been quite active.             │
│                                      │
│  [📍 Focus on Perfectionist]        │
│  [🔍 Choose Different Part]         │
│  [💭 Just Chat]                     │
└─────────────────────────────────────┘
```

**UX Decision Point**: Should this be in the Inbox or a special "weekly focus" card?

- **Recommendation**: Special card that appears Sunday evening through Monday

Sarah taps "Focus on Perfectionist"

### Monday Morning - Setting Intention

**Check-in Flow** (modified for weekly focus):

```
Morning Check-in
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

How are you feeling about exploring
your Perfectionist this week?

[Slider: Curious ←→ Hesitant]

What would you like to understand
about this part?

[Text field with prompts:]
• Its origin story
• What it's protecting you from
• How it helps and hinders
• Its relationship with other parts

[Continue]
```

**Issue Found**: Current check-in is generic mood/energy. Need to add focus-aware questions.

### Monday Afternoon - First Focused Chat

Sarah opens chat. The agent now has context:

**Agent**: "I see you're exploring your Perfectionist this week and you're curious about what it's protecting you from. Want to start there?"

**Sarah**: "Yes, I think it's related to my fear of criticism"

**Agent**: "That's an important connection. Can you tell me about a recent time when your Perfectionist showed up around criticism?"

**Key Enhancement Needed**: Agent needs a "weekly focus mode" in system prompt

### Tuesday - The Observation Surfaces

**Inbox** shows a new observation:

```
┌─────────────────────────────────────┐
│ 🔍 Pattern Noticed                  │
│                                      │
│ Your Perfectionist seems most       │
│ active in work emails, especially   │
│ when messaging your manager.         │
│                                      │
│ Yesterday you revised an email      │
│ 4 times before sending.             │
│                                      │
│ [That's right] [Not quite] [Tell me more]
└─────────────────────────────────────┘
```

**Problem**: Current observation engine doesn't know about weekly focus
**Solution**: Pass weekly focus to observation agent for targeted insights

### Wednesday - Discovering Relationships

Sarah chats about the email pattern:

**Sarah**: "I realized the Perfectionist is trying to protect a younger part that got humiliated in school"

**System Action**:

- Creates emerging "Humiliated Child" part
- Links it to Perfectionist as "protector-exile" relationship
- Updates this week's narrative

**Parts Garden** now highlights:

- Perfectionist (this week's focus) in center
- Newly discovered Humiliated Child
- Their protection relationship

### Thursday - Check-in Evolution

**Evening Check-in** (focus-aware):

```
How did your Perfectionist show up today?

[Multiple choice - can select multiple]:
□ Work tasks
□ Personal relationships
□ Self-care
□ Didn't notice it
□ Other: ___

Any new insights about this part?
[Text field]
```

### Friday - The Story Emerges

**Inbox** generates a mid-week summary:

```
┌─────────────────────────────────────┐
│ 📖 Your Perfectionist's Story       │
│    (So Far This Week)               │
│                                      │
│ Started: Curious about protection   │
│ Discovered: Protecting a young part │
│ Pattern: Most active in work emails │
│ Shift: Starting to notice it sooner │
│                                      │
│ Continue exploring this weekend?    │
│ [Yes] [Ready for new focus]         │
└─────────────────────────────────────┘
```

### Saturday - Optional Deep Dive

If Sarah engages:

**Chat** offers: "Want to try a dialogue between your Perfectionist and the part it's protecting?"

**New Feature Needed**: Guided dialogue mode in chat

### Sunday - Weekly Reflection

**Special Sunday Check-in**:

```
This Week with Your Perfectionist
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

How well do you understand this part now?
[Slider: Still mysterious ←→ Much clearer]

What's the most important thing you learned?
[Text field]

How has your relationship with it changed?
[Text field]

Ready to explore a new part next week?
[Yes, suggest one] [Continue with Perfectionist] [Take a break]
```

## Critical UX Adjustments Needed

### 1. **Focus Persistence**

- Add `weekly_focus` table: `{user_id, part_id, week_start, status}`
- All features need to read this context

### 2. **Smart Transitions**

- **Problem**: What if urgent part emerges mid-week?
- **Solution**: "Parking lot" concept
  ```
  "I notice your Anxious part is really active.
   Want to [Pause Perfectionist] or [Note for next week]?"
  ```

### 3. **Progress Visualization**

- Add "Journey View" to Parts Garden showing weekly evolution
- Visual timeline of which parts were explored when

### 4. **Narrative Memory**

- Each week generates a "chapter" stored in user memory
- Chapters build into larger story arcs

### 5. **Gentle Onboarding to Focus**

- Week 1-2: Optional focus (can just chat)
- Week 3+: System suggests focus based on patterns
- Always can opt-out to free-form

## What's Missing for This to Work

### Must-Haves

1. **Weekly Focus Selection UI** - New component for Sunday/Monday
2. **Focus-Aware Check-ins** - Dynamic questions based on weekly part
3. **Focus Context in Chat** - System prompt modification
4. **Observation Engine Focus Filter** - Prioritize weekly part patterns
5. **Weekly Reflection Flow** - Special Sunday check-in

### Nice-to-Haves

1. **Guided Dialogue Mode** - Structured conversations between parts
2. **Journey Timeline** - Visual progress through parts
3. **Chapter Summaries** - AI-generated narrative of each week
4. **Part Graduate Status** - Mark parts as "understood" vs "exploring"

## Potential Friction Points

### 1. **Too Much Structure?**

**Risk**: Users feel locked into weekly rhythm
**Mitigation**:

- Always show "Just Chat" option
- Allow mid-week focus changes
- "Focus-free" weeks as option

### 2. **What If Part Isn't Active?**

**Risk**: Forced to explore dormant part
**Mitigation**:

- Only suggest recently active parts
- "This part seems quiet - explore anyway or pick another?"

### 3. **Overwhelming for New Users?**

**Risk**: Too much too soon
**Mitigation**:

- First 2 weeks: No focus, just discover parts
- Week 3: "Ready to go deeper with one part?"
- Gradual introduction

### 4. **Loss of Spontaneity?**

**Risk**: Everything becomes about the weekly part
**Mitigation**:

- 80/20 rule: 80% focused, 20% open exploration
- "Something else coming up?" prompt in chat

## Revised Recommendation

The Guided Journey works BUT needs these adjustments:

1. **Softer Structure**: Focus is a "theme" not a requirement
2. **Multiple Entry Points**: Can engage via chat, check-in, OR inbox
3. **Progressive Disclosure**: Features unlock as user engages more
4. **Escape Hatches**: Always can pivot if something urgent arises
5. **Celebration Moments**: Mark progress clearly (badges? streaks?)

The key insight: **Make it feel like a choose-your-own-adventure book, not a curriculum**

Users should feel they're discovering their story, not completing assignments.
