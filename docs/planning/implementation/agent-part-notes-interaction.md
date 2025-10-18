# Agent Interaction with Part Notes & Lifecycle Updates

**Bead ID:** ifs-chat-app-19  
**Status:** Planning  
**Created:** 2025-10-18  
**Related Work:** Garden UI redesign (ifs-chat-app-20)

---

## Problem Statement

The IFS agent has tools to update parts (`updatePart`, `logEvidence`, clarification notes), but the interaction patterns are inconsistent. This leads to:

- Unclear when the agent should call `updatePart` vs. just acknowledging in chat
- Role/purpose may not be consistently captured when users clarify
- Evidence tracking is optional and underutilized
- Clarification notes are user-initiated only (via UI button), not agent-driven
- No guidance on when to update `last_charged_at`/`last_charge_intensity`

This matters for the garden UI because users need **consistent, accurate data** to trust what they see:
- If role/purpose isn't captured during conversations, the card preview will be blank
- If evidence isn't logged, the evidence count won't reflect the part's true backing
- If lifecycle transitions aren't marked, status badges won't reflect reality

---

## Success Criteria

✅ Agent has clear decision tree for when to call `updatePart`, `logEvidence`, and `addPartNote`  
✅ Role/purpose is captured when user clarifies part's function  
✅ Lifecycle transitions (emerging → active) are marked in part.status when evidence supports it  
✅ Evidence is logged for each meaningful observation (minimum, not over-logging)  
✅ Last active timestamp is always current (auto-updated by system on every part touch)  
✅ Garden cards display accurate, up-to-date data from agent interactions  

---

## Design: Agent Decision Trees

### When to Call `updatePart` (with updates field)

**Call `updatePart` if:**

1. **User clarifies part's role/function**
   - User: "This is my inner critic—it protects me from making mistakes"
   - Action: `updatePart({ partId, updates: { role: "inner critic that protects me from mistakes" } })`
   - Why: Role is displayed on garden cards; users need accurate preview

2. **User or agent infers category change with high confidence**
   - User: "This part feels protective, like it's keeping me from being rejected"
   - Action: `updatePart({ partId, updates: { category: 'manager' } })`
   - Why: Category affects visual grouping; only update if clear

3. **User confirms part's name has changed or needs clarification**
   - User: "I think I want to call this part 'The Protector' not just 'Protector'"
   - Action: `updatePart({ partId, updates: { name: "The Protector" } })`
   - Why: Name is the primary identifier

4. **Part shows clear status transition with supporting evidence**
   - Emerging → Acknowledged: When part is named and role is clear
   - Acknowledged → Active: When part shows up repeatedly in sessions (3+ observations)
   - Active → Integrated: When part's role is harmonious with system (subjective; rare to auto-update)
   - Action: `updatePart({ partId, updates: { status: 'active' }, auditNote: "Transitioned based on 5 observations and active engagement" })`
   - Why: Status affects card visual prominence and user's understanding of part maturity

5. **User describes emotions/triggers/beliefs for the part**
   - User: "When I'm criticized, this part feels ashamed and tries to hide"
   - Action: `updatePart({ partId, updates: { emotions: ['shame', 'fear'], triggers: ['criticism', 'judgment'] } })`
   - Why: These characterize the part's signature; append to existing arrays

6. **User or agent changes emoji**
   - User: "Can we use a shield emoji instead?"
   - Action: `updatePart({ partId, updates: { visualization: { emoji: '🛡️' } } })`
   - Why: Emoji is the visual anchor; user customization should be preserved

**Do NOT call `updatePart` for:**
- Restating what's already recorded (check with `getPartById` first)
- Paraphrasing something the user already said earlier in chat
- Speculative changes; only update when there's clear new information
- Every observation (use `logEvidence` instead)

---

### When to Call `logEvidence`

**Call `logEvidence` for:**

Each distinct, meaningful observation that backs up the part's existence/nature.

**Example observations:**
- "User noticed this part activated during a code review—felt panic and urge to hide mistakes"
- "Part showed up when friend gave feedback—interpreted it as rejection"
- "User observed this part's voice: 'You're doing it wrong again'"
- "Pattern: Every time there's ambiguity, this part steps in to control the outcome"

**How often:**
- **Not per message** (too granular)
- **Once per meaningful observation** per session
- **Minimum 3** before a part can emerge; **5-7** is ideal evidence for confident identification

**Schema:**
```
{
  type: 'direct_mention' | 'pattern' | 'behavior' | 'emotion',
  content: 'What was observed',
  confidence: 0.0 - 1.0,  // How certain this observation is
  sessionId: 'session-uuid',
  timestamp: 'ISO datetime'
}
```

**Examples:**
- Direct mention: "User said 'That's my inner perfectionist talking'"
- Pattern: "Every time code goes to review, this part activates with anxiety"
- Behavior: "User spent 3 hours refactoring minor details instead of shipping"
- Emotion: "User felt shame and self-doubt when mentor gave feedback"

---

### When to Add Clarification Notes (via `addPartNote`)

**Agent should suggest/offer:**

When user shares something reflective that's worth capturing outside the conversation flow.

**Example triggers:**
- User has a realization: "Oh, I think this part comes from when my dad was critical"
- User describes a specific scenario they want to remember: "This happens every Monday morning"
- User asks for reflection: "What should I remember about this part?"

**How agent should handle:**
1. Recognize the moment
2. Offer to save: "This feels important—would you like me to save this as a note about [Part]?"
3. If user confirms, call `addPartNote({ partId, content: "User's exact or paraphrased insight" })`
4. If user declines, don't force it

**Why:**
- Keeps therapeutic flow natural (not interrupting to save)
- Clarification notes are more reflective than evidence (less operational, more meaning-making)
- Shows respect for user's autonomy over what gets recorded

---

### When to Update `last_charge_intensity` / `last_charged_at`

**Only when:**

Agent or user explicitly discusses the part's current "charge" (emotional intensity, activation level).

**Example:**
- User: "Right now, this part is really activated—I'm anxious and my body feels tight"
- Action: `updatePart({ partId, updates: { last_charge_intensity: 0.8, last_charged_at: new Date().toISOString() } })`

**Why:**
- `last_charged_at` is currently sparse/optional—only set if intentional
- This data could power future visualizations (energy level)
- For now, leave these fields alone unless explicitly relevant

**Current Status:** Rarely set; not used in UI yet. Can defer.

---

## Implementation Checklist

### Agent Prompt Updates
- [ ] Add decision tree to `ifs_agent_prompt.ts`
- [ ] Clarify: Call `updatePart` when user clarifies role, not speculatively
- [ ] Clarify: Log evidence for each observation, but not over-log
- [ ] Clarify: Offer to save clarification notes (respect autonomy)
- [ ] Clarify: Update status only with clear evidence of lifecycle transition

### Tool Behavior Expectations
- [ ] `updatePart` - agent filters to meaningful changes only
- [ ] `logEvidence` - agent logs at least 1 per session if discovering parts
- [ ] `addPartNote` - agent offers to save, doesn't auto-capture
- [ ] `last_active` - system auto-updates on every part touch (no agent action needed)

### Garden UI Implications
- [ ] Role/purpose shows on card if populated by agent during conversations
- [ ] Evidence count displayed accurately (reflects logged observations)
- [ ] Status badge reflects actual lifecycle stage (agent should transition when ready)
- [ ] Card preview is honest: only shows data that's been explicitly captured

---

## Related Context

- **IFS Agent Prompt:** `/mastra/agents/ifs_agent_prompt.ts`
- **Part Tools:** `/mastra/tools/part-tools.mastra.ts`
- **Part Schema:** `/lib/data/parts.schema.ts`
- **UpdatePart Implementation:** `/lib/data/schema/parts-agent.ts` (line ~250)
- **Garden Cards:** `/components/garden/PartsList.tsx` (to be updated)

---

## Notes & Decisions

### Decision: Role/Purpose on Cards
**Q:** Should role/purpose always show, or only if populated?  
**A:** Show when available; if empty, just show name. This encourages agent to fill it in.

### Decision: Status Transitions
**Q:** Should agent auto-transition status or wait for user confirmation?  
**A:** Agent should flag it ("This part has shown up in 5+ observations—ready to move from emerging to active?") but not auto-update. Users own their part journey.

### Decision: Evidence Over-Logging
**Q:** Will too much evidence logging bloat the data?  
**A:** Unlikely. Even with 50 parts × 10 observations each, that's 500 records. Fine for indexing. Quality > quantity.

### Future Scope
- [ ] Timeline view showing when parts emerged, transitioned through lifecycle
- [ ] Evidence feed visible in part detail page
- [ ] Automated status transitions based on thresholds
- [ ] Charge intensity visualization on cards (when `last_charge_intensity` is consistently set)

---

## Success Metrics

After agent changes are live:

1. **Role/purpose populated:** 80%+ of established parts have non-empty role field
2. **Evidence logged:** Average 5+ observations per active part
3. **Status accuracy:** Part status reflects actual lifecycle stage 90%+ of time
4. **Garden cards trust:** Users report that card information matches their understanding
