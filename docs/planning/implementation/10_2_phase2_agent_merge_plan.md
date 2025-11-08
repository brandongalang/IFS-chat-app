# Phase 2: Unified Agent Merge Plan

**Date:** 2025-11-08  
**Scope:** Merge insight-generator and inbox-observation agents into single unified agent

## Current Agent Architecture

### insight-generator Agent
**Location:** `mastra/agents/insight-generator.ts`  
**Tools (4):**
1. `getRecentSessions` - Fetch sessions within lookback period
2. `getActiveParts` - Get recently active parts
3. `getPolarizedRelationships` - Get conflicted part relationships
4. `getRecentInsights` - Get previous insights

**Output Types (5):**
- session_summary
- nudge
- follow_up
- observation
- question

**System Prompt Strategy:** Research phase → Writing phase with 4 plays
- Play #1: New Part Candidate
- Play #2: Relationship Tension
- Play #3: Dormant Part Check-in
- Play #4: Session Follow-up

**Max Output:** 2 insights per run

### inbox-observation Agent
**Location:** `mastra/agents/inbox-observation.ts`  
**Tools (9):**
1. `searchParts` - Search parts by criteria
2. `getPartById` - Get specific part
3. `getPartDetail` - Get part with relationships/history
4. `queryTherapyData` - Query observations, notes, relationships
5. `writeTherapyData` - Write new therapy data
6. `updateTherapyData` - Update existing therapy data
7. `listCheckIns` - List recent check-ins
8. `searchCheckIns` - Search check-in content
9. `getCheckInDetail` - Get specific check-in

**Output Types (5):**
- title
- summary
- inference
- evidence (array)

**System Prompt Strategy:** 2-phase research then infer
- Phase 1: Search parts, query therapy data, list check-ins
- Phase 2: Identify patterns, draft inferences with evidence

**Max Output:** 3 observations per run

## Unified Agent Design

### Name & Location
**File:** `mastra/agents/unified-inbox.ts`  
**Export:** `createUnifiedInboxAgent(profile, config)`

### Tools (13 combined)
**From insight-research-tools (4):**
- getRecentSessions
- getActiveParts
- getPolarizedRelationships
- getRecentInsights

**From observation-tools (9):**
- searchParts
- getPartById
- getPartDetail
- queryTherapyData
- writeTherapyData
- updateTherapyData
- listCheckIns
- searchCheckIns
- getCheckInDetail

### Output Types (6 unified)
```typescript
export const unifiedInboxSchema = z.object({
  type: z.enum([
    'session_summary',    // From insight
    'nudge',             // From insight
    'follow_up',         // From insight
    'observation',       // From insight/observation
    'question',          // From insight
    'pattern',           // New: merged/synthesized insights
  ]),
  title: z.string().max(100),
  summary: z.string().max(500),
  body: z.string().max(500).optional(), // For nudge/follow_up
  inference: z.string().max(500).optional(), // For observation
  evidence: z.array(z.object({
    type: z.enum(['session', 'part', 'observation', 'checkin', 'relationship']),
    id: z.string().uuid(),
    context: z.string().optional(),
  })).optional(),
  sourceSessionIds: z.array(z.string().uuid()).optional(),
})
```

### System Prompt Architecture

**Phase 1: Unified Research**
```
1. Search parts and sessions
2. Query therapy data and check-ins
3. Get detail on key findings
4. Identify active parts, relationships, patterns
```

**Phase 2: Consolidated Analysis**
- Combine insight "plays" with observation "inference" logic
- Apply both insight generation heuristics AND therapy data patterns
- Generate 4-6 items max (blend of both styles)

**Phase 3: Unified Generation**
- Type-appropriate formatting for each output type
- Evidence threading for observations/patterns
- Session references for summaries/follow-ups

### Configuration Options

```typescript
interface UnifiedInboxAgentConfig {
  modelId?: string                    // LLM model
  baseURL?: string                    // OpenRouter URL
  temperature?: number                // Temperature
  requestId?: string                  // For telemetry
  runId?: string                      // For telemetry
  maxOutputItems?: number             // Default: 5
  includeSessionSummary?: boolean     // Default: true
  includeObservations?: boolean       // Default: true
}
```

## Implementation Steps

### Step 2a: Analyze & Plan Merging
- ✅ Understand tool differences (insight uses resolveUserId, observation tracks verbose logging)
- ✅ Understand output type overlap
- ✅ Understand prompt philosophies

### Step 2b: Create Unified Tools File
**File:** `mastra/tools/unified-inbox-tools.ts`
- Export `createUnifiedInboxTools(baseUserId, ctx)`
- Import both insight + observation tool creators
- Return combined tool set with 13 tools
- Keep logging consistent

### Step 2c: Create Unified Agent
**File:** `mastra/agents/unified-inbox.ts`
- Define `unifiedInboxSchema` with 6 output types
- Write merged system prompt (research → unified analysis → generation)
- Create `createUnifiedInboxAgent(profile, config)`
- Support both old agents' calling patterns

### Step 2d: Deprecate Old Agents
- Mark `insight-generator.ts` as deprecated
- Mark `inbox-observation.ts` as deprecated
- Add migration notes
- Keep exports for backward compatibility

## Key Design Decisions

1. **Tool Deduplication:** searchParts exists in both; use observation version (more mature)
2. **Logging:** Keep observation's verbose logging pattern (more detailed)
3. **Output Format:** New schema unifies both types, handles evidence threading
4. **Config Options:** Support knobs for research depth, output count
5. **Backward Compat:** Keep old agents working but mark deprecated

## Testing Strategy

1. **Tool Integration:** Verify all 13 tools execute without error
2. **Schema Validation:** Test all 6 output types generate valid JSON
3. **Evidence Threading:** Ensure observation evidence properly cross-references
4. **Session Summary:** Ensure summary type extracts from sessions correctly
5. **Play Coverage:** Verify insight plays still trigger correctly
6. **Max Output:** Test output limiting (don't generate more than 5-6 items)

## Files to Create/Modify

**Create:**
- `mastra/agents/unified-inbox.ts` (new unified agent)
- `mastra/tools/unified-inbox-tools.ts` (new combined tools)

**Modify:**
- `mastra/agents/insight-generator.ts` (add deprecation notice)
- `mastra/agents/inbox-observation.ts` (add deprecation notice)
- `mastra/index.ts` (export unified agent)

**Keep Unchanged:**
- `mastra/tools/insight-research-tools.ts` (reusable)
- `mastra/tools/inbox-observation-tools.ts` (reusable)

## Acceptance Criteria for Phase 2

✅ unified-inbox.ts created with merged system prompt  
✅ unified-inbox-tools.ts created combining all 13 tools  
✅ unifiedInboxSchema defined with 6 output types  
✅ All tools tested and verified working  
✅ Agent exports in mastra/index.ts  
✅ Old agents marked deprecated  
✅ Typecheck passes  
✅ Lint passes  

## Next Phase (Phase 3)

DB migration to create unified inbox_items table that can store all 6 types with proper evidence threading.
