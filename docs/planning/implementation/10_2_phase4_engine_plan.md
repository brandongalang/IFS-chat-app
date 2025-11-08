# Phase 4: Unified Inbox Engine Update

**Date:** 2025-11-08  
**Status:** In Progress  
**Scope:** Extend inbox engine to support 6 output types

## Current State

**observation-engine.ts:**
- Currently inserts into `inbox_observations` table
- Works with `ObservationCandidate` schema (inference-focused)
- Supports deduplication via semantic_hash
- Has queue limiting and history checking
- Extensive telemetry and trace building

**observation-schema.ts:**
- Defines `ObservationCandidate` (only observation type)
- Has `ObservationEvidence` with sessionId, checkInId, source, quote, metadata
- Evidence array max 10 items, title/summary/inference required

**unified-inbox.ts (new agent):**
- Outputs `UnifiedInboxItem` with 6 types
- Has `content`, `metadata`, `evidence` (structured)
- source_session_ids array for session references

## Phase 4 Tasks

### 4a: Create Unified Inbox Schema
**File:** `lib/inbox/unified-inbox-schema.ts` (NEW)

Define schemas for all 6 output types:

```typescript
UnifiedInboxItemCandidate {
  type: enum (6 types),
  title: string,
  summary: string,
  body?: string,        // For nudge, follow_up
  inference?: string,   // For observation, question
  evidence?: [{type, id, context}],  // For observations/patterns
  relatedPartIds?: uuid[],
  sourceSessionIds?: uuid[],
  confidence?: number,
  metadata?: record,
}

UnifiedInboxItemBatch {
  items: UnifiedInboxItemCandidate[],
  notes?: string,
}
```

Key differences from ObservationCandidate:
- `type` field (new)
- `body` instead of just `inference`
- Evidence is structured {type, id, context} not {type, summary, sessionId, checkInId}
- No `rationale`, `tags`, `timeframe` (for now)

### 4b: Update Inbox Engine
**File:** `lib/inbox/unified-inbox-engine.ts` (NEW)

Create new engine that:
- Accepts `UnifiedInboxAgent` instead of `InboxObservationAgent`
- Inserts into `inbox_items` table instead of `inbox_observations`
- Handles all 6 output types
- Maintains queue limiting, deduplication, telemetry
- Uses `unifiedInboxSchema` for parsing
- Evidence threading (map from structured format)

Key changes:
1. **Queue Management:** Still uses `getInboxQueueSnapshot` but now for `inbox_items`
2. **History Check:** Fetch from `inbox_items` with semantic_hash deduplication
3. **Agent Invocation:** Input to unified agent (slightly different prompt)
4. **Parsing:** Use `unifiedInboxSchema` instead of `observationBatchSchema`
5. **Insertion:** Map to `inbox_items` table schema
6. **Evidence:** Transform structured evidence format

### 4c: Keep Old Engine for Backward Compat
**Option:** Deprecate `observation-engine.ts` or keep both
- Keep observation engine working for now (marked @deprecated)
- New code uses unified engine
- Old routes can still use observation engine

## Implementation Details

### UnifiedInboxSchema

```typescript
// Evidence for observations/patterns
const unifiedEvidenceSchema = z.object({
  type: z.enum(['session', 'part', 'observation', 'checkin', 'relationship']),
  id: z.string().uuid(),
  context: z.string().optional(),
})

// Main item schema (supports all 6 types)
const unifiedInboxItemCandidateSchema = z.object({
  type: z.enum([
    'session_summary', 'nudge', 'follow_up',
    'observation', 'question', 'pattern'
  ]),
  title: z.string().min(4).max(140),
  summary: z.string().min(10).max(400),
  body: z.string().max(500).optional(),     // For nudge, follow_up
  inference: z.string().max(500).optional(), // For observation, question
  evidence: z.array(unifiedEvidenceSchema).optional(),  // For observations, patterns
  relatedPartIds: z.array(z.string().uuid()).optional(),
  sourceSessionIds: z.array(z.string().uuid()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const unifiedInboxBatchSchema = z.object({
  items: z.array(unifiedInboxItemCandidateSchema).max(6),
  notes: z.string().optional(),
})
```

### Database Insertion

Map from UnifiedInboxItemCandidate to inbox_items columns:

```sql
INSERT INTO inbox_items (
  user_id,
  type,
  status,
  content,
  metadata,
  evidence,
  related_part_ids,
  source_session_ids,
  confidence,
  source_type
)
VALUES (...)
```

### Queue Snapshot Query

Change query to use `inbox_items` instead of `inbox_observations`:

```sql
SELECT COUNT(*) as total, 
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
FROM inbox_items
WHERE user_id = $1 AND status IN ('pending', 'queued')
```

### Deduplication

Compute semantic_hash from all 6 types:

```typescript
function computeSemanticHash(item: UnifiedInboxItemCandidate): string {
  const parts = [
    item.type,
    item.title,
    item.summary,
    item.body ?? '',
    item.inference ?? '',
  ]
  if (item.relatedPartIds?.length) {
    parts.push(item.relatedPartIds.sort().join('|'))
  }
  if (item.sourceSessionIds?.length) {
    parts.push(item.sourceSessionIds.sort().join('|'))
  }
  return createHash('sha256').update(parts.join('::')).digest('hex')
}
```

## Files to Create/Modify

**Create:**
- `lib/inbox/unified-inbox-schema.ts` - New schema for all 6 types
- `lib/inbox/unified-inbox-engine.ts` - New engine for unified agent

**Modify:**
- `lib/inbox/observation-schema.ts` - Add @deprecated notice
- `lib/inbox/observation-engine.ts` - Add @deprecated notice

**Keep Unchanged:**
- `lib/inbox/search/` (evidence resolution still works)
- `lib/data/inbox-queue.ts` (can be updated for inbox_items)

## Acceptance Criteria

✅ unifiedInboxSchema supports all 6 types  
✅ unifiedInboxEngine inserts into inbox_items  
✅ Queue limiting works with inbox_items  
✅ Deduplication via semantic_hash  
✅ Evidence threading for observations/patterns  
✅ Type-appropriate content mapping (title, summary, body, inference)  
✅ Telemetry still functional  
✅ Old engine marked @deprecated but still working  
✅ typecheck passes  
✅ lint passes

## Next Phase (Phase 5)

Update routes to use `createUnifiedInboxAgent()` and `runUnifiedInboxEngine()` instead of old versions.
