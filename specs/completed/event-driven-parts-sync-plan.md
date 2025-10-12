# Event-Driven Parts Sync Implementation Plan

## Overview

Automatically sync markdown part profiles to the Supabase database whenever they're created or updated, ensuring the Garden UI always shows current data.

## Current State

- ✅ **Markdown creation**: `ensurePartProfileExists()` creates `.md` files
- ✅ **Sync function**: `onPartProfileChanged()` syncs markdown → database  
- ❌ **Hook not wired**: Sync function not called after markdown writes

## Implementation Strategy

### Approach: Add sync hooks to existing lifecycle functions

Wire `onPartProfileChanged()` into the existing `onPartCreated()` and `onPartUpdated()` functions.

**Rationale**: 
- Minimal code changes
- Centralized in one file (`lib/memory/snapshots/updater.ts`)
- Automatically covers all part creation/update flows
- No need to modify agent tools or higher-level code

## Code Changes

### File: `lib/memory/snapshots/updater.ts`

**Change 1: Import the sync function**
```typescript
// Add to imports at top of file
import { onPartProfileChanged } from '@/lib/memory/parts-sync'
```

**Change 2: Add sync to `onPartCreated()`**
```typescript
export async function onPartCreated(params: { 
  userId: string
  partId: string
  name: string
  status: string
  category: string 
}) {
  const { path } = await ensurePartProfileExists(params)
  await appendChangeLogWithEvent({
    userId: params.userId,
    entityType: 'part',
    entityId: params.partId,
    filePath: path,
    line: `created part "${params.name}" (status: ${params.status}, category: ${params.category})`,
  })
  
  // NEW: Sync to database immediately after markdown write
  await onPartProfileChanged(params.userId, params.partId)
}
```

**Change 3: Add sync to `onPartUpdated()`**
```typescript
export async function onPartUpdated(params: { 
  userId: string
  partId: string
  name: string
  change: string 
}) {
  const { path } = await ensurePartProfileExists({ 
    userId: params.userId, 
    partId: params.partId, 
    name: params.name, 
    status: 'unknown', 
    category: 'unknown' 
  })
  await appendChangeLogWithEvent({
    userId: params.userId,
    entityType: 'part',
    entityId: params.partId,
    filePath: path,
    line: `updated part "${params.name}": ${params.change}`,
  })
  
  // NEW: Sync to database immediately after markdown write
  await onPartProfileChanged(params.userId, params.partId)
}
```

**Change 4: Add sync to `ensurePartProfileExists()` for safety**
```typescript
export async function ensurePartProfileExists(params: { 
  userId: string
  partId: string
  name: string
  status: string
  category: string 
}): Promise<{ path: string; created: boolean }> {
  const storage = await getStorageAdapter()
  const path = partProfilePath(params.userId, params.partId)
  const exists = await storage.exists(path)
  if (!exists) {
    const md = buildPartProfileMarkdown(params)
    await storage.putText(path, md, { contentType: 'text/markdown; charset=utf-8' })
    
    // NEW: If we just created a new profile, sync it immediately
    await onPartProfileChanged(params.userId, params.partId)
    
    return { path, created: true }
  }
  return { path, created: false }
}
```

## Benefits

✅ **Automatic**: No manual intervention needed  
✅ **Real-time**: Parts appear in Garden immediately after agent creates them  
✅ **Reliable**: Syncs happen right after markdown write (no race conditions)  
✅ **Simple**: Only 3 function calls added, all in one file  
✅ **Safe**: If sync fails, markdown is still saved (degraded but not broken)  

## Error Handling

The `onPartProfileChanged()` function already includes:
- Try/catch blocks
- Console logging
- Non-blocking execution (won't throw if sync fails)

**Behavior on failure**:
- Markdown write succeeds (agent memory preserved)
- Database sync fails silently (logged to console)
- Manual sync or cron job can backfill later

## Testing Plan

1. **Create a new part via chat**
   - Agent creates markdown file
   - Sync automatically triggered
   - Part appears in Garden immediately

2. **Update an existing part via chat**
   - Agent updates markdown
   - Sync automatically triggered  
   - Garden UI reflects changes

3. **Verify sync failure handling**
   - Temporarily break database connection
   - Create a part
   - Confirm markdown still created
   - Confirm error logged but no crash

## Rollout

1. ✅ Manual sync (backfill existing parts) - `scripts/sync-parts-manual.ts`
2. Deploy this event-driven sync
3. Optional: Add cron job as safety net (every 6 hours)
4. Monitor sync success/failure rates

## Alternative: Sync in Agent Tools

Instead of syncing in `updater.ts`, we could add sync calls to the agent tools themselves (e.g., `mastra/tools/part-content-tools.ts` → `createPartTool`, `updatePartContentTool`).

**Pros**: More explicit control at the tool level  
**Cons**: 
- More places to update
- Tools are for markdown operations, not database sync (separation of concerns)
- Harder to ensure all code paths covered

**Recommendation**: Stick with `updater.ts` approach (centralized lifecycle hooks)

## Future Enhancements

- **Batch sync**: Queue multiple changes, sync in batches
- **Conflict resolution**: Handle concurrent markdown/database edits
- **Sync status UI**: Show users when sync is pending/failed
- **Webhooks**: Trigger external integrations on part changes

## Related Files

- Implementation: `lib/memory/snapshots/updater.ts`
- Sync logic: `lib/memory/parts-sync.ts` 
- Agent tools: `mastra/tools/part-content-tools.ts` (indirect)
- Garden UI: `app/(tabs)/garden/page.tsx` (consumer)
