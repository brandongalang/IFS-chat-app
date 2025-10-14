# Parts Sync Troubleshooting - 2025-10-13

## Issue Report

**User**: brandongalang@aya.yale.edu  
**Date**: October 13, 2025  
**Symptom**: Agent reports 9 parts exist, but Parts Garden shows 0 parts

## Root Cause Analysis

### Two Separate Data Stores

The system maintains parts data in two locations:

1. **Memory V2 Markdown Files** (Supabase Storage `memory-snapshots` bucket)
   - Path: `users/{userId}/parts/{partId}/profile.md`
   - Used by: Agent for conversation context
   - Status: ✅ Contains 9 parts

2. **Postgres Database** (`parts` table)
   - Used by: Parts Garden UI, Check-ins, Search
   - Status: ❌ Empty (0 parts)

### Primary Bug: Path Mismatch

**File**: `lib/memory/parts-sync.ts`  
**Function**: `discoverUserParts()`

**Bug**: Incorrect storage path preventing part discovery
```typescript
// BEFORE (incorrect)
const basePath = `${userId}/parts`;  // Missing "users/" prefix

// AFTER (fixed)
const basePath = `users/${userId}/parts`;  // Matches partProfilePath()
```

**Impact**: The sync function couldn't find any markdown part profiles, resulting in 0 parts being synced to the database.

### Secondary Issue: Insufficient Logging

The sync process had minimal logging, making it difficult to diagnose failures. Users clicking the "Refresh" button in Parts Garden had no visibility into what was happening.

## Fixes Applied

### 1. Path Fix
- Updated `discoverUserParts()` to use correct path with "users/" prefix
- Now matches the path structure used by `partProfilePath()` helper

### 2. Comprehensive Logging
Added detailed console logging throughout the sync flow:

**Garden UI** (`app/(tabs)/garden/page.tsx`):
- Button click confirmation
- Server action call and response
- Part refetch results

**Server Action** (`app/(tabs)/garden/actions.ts`):
- Authentication status
- User ID and email
- Sync initiation and completion
- Error details with stack traces

**Sync Logic** (`lib/memory/parts-sync.ts`):
- Storage discovery process
- Each part being processed
- Database operations (create/update/skip)
- Success/failure for each part

### 3. Debug Script
Created `scripts/test-parts-sync.ts` for manual testing:
- Checks storage paths
- Lists discovered parts
- Runs sync
- Verifies database state

## How to Use

### For Users: Sync Parts via Garden UI
1. Navigate to `/garden`
2. Click the "Refresh" button (circular arrow icon)
3. Check browser console for detailed logs
4. Success message will show sync count

### For Developers: Manual Testing
```bash
npx tsx scripts/test-parts-sync.ts user@example.com
```

This will:
- Find user profile
- Check storage paths
- Discover parts
- Sync to database
- Verify results

## Verification Steps

After applying fixes, verify sync works:

1. **Check logs** - Look for these key messages:
   ```
   [syncPartsAction] User authenticated: {userId}
   [discoverUserParts] Found {N} entries in storage
   [discoverUserParts] Discovered {N} part IDs
   [syncPartToDatabase] ✅ Created part {partId} in database
   [syncAllUserParts] Parts sync complete: {N} synced, 0 failed
   ```

2. **Check database** - Query parts table:
   ```sql
   SELECT count(*) FROM parts WHERE user_id = '{userId}';
   ```

3. **Check UI** - Parts Garden should display all parts

## Prevention

### Automated Testing
- Add integration test for parts sync
- Test path resolution in CI
- Verify markdown → database sync

### Monitoring
- Log sync operations in production
- Alert on repeated sync failures
- Track sync success rate per user

### Documentation
- Update Memory V2 architecture docs with path conventions
- Document sync process in developer guide
- Add troubleshooting section to runbooks

## Related Files

- `lib/memory/parts-sync.ts` - Main sync logic
- `lib/memory/snapshots/fs-helpers.ts` - Path helper functions
- `app/(tabs)/garden/actions.ts` - Server action for manual sync
- `app/(tabs)/garden/page.tsx` - UI with Refresh button
- `lib/data/parts-lite.ts` - Client-side parts queries

## Related Documentation

- [Memory V2 Architecture](../../features/memory/v2/agentic-memory-v2-decisions.md)
- [Parts System Overview](../../architecture/parts-systems-overview.md)
- [Storage Configuration](../../features/memory/v2/data-schema.md)
