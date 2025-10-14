# Parts Garden Sync Issue - Complete Analysis

## Executive Summary

The Parts Garden shows 0 parts despite the agent successfully finding and creating parts because of a **dual storage system** where parts exist in markdown files (Supabase Storage) but aren't synced to the database (Postgres) that the UI reads from. The root cause was a path mismatch bug that has been fixed, but may require manual sync.

## How the Parts Garden Works

### 1. Data Flow Architecture

```
Agent Tools → Markdown Files → Sync Process → Database → Parts Garden UI
```

#### Two Storage Systems:

1. **Markdown Storage** (Source of Truth)
   - Location: Supabase Storage `memory-snapshots` bucket
   - Path: `users/{userId}/parts/{partId}/profile.md`
   - Used by: Agent tools for conversation context
   - Created by: `createPartProfileMarkdown` tool

2. **Postgres Database** (UI Cache)
   - Table: `parts`
   - Used by: Parts Garden UI, Check-ins, Search
   - Populated by: Sync process from markdown files

### 2. Parts Garden Display Logic

The Parts Garden UI (`app/(tabs)/garden/page.tsx`) displays parts by:

1. **On Page Load**:
   - Calls `searchParts()` which queries the Postgres `parts` table
   - Displays parts in either Grid View or Graph View
   - Shows relationships between parts (Graph View only)

2. **Data Fetching**:

   ```typescript
   // Line 149: Fetches parts from database
   const partsResult = await searchParts({ limit: 50 });
   setParts(partsResult);
   ```

3. **Rendering**:
   - Grid View: Shows part cards with emoji, name, role
   - Graph View: Interactive force-directed graph with charge visualization

### 3. The Refresh Button

The Refresh button triggers a manual sync process:

1. **Button Click** (Line 307-316):
   - Shows spinning icon
   - Calls `syncPartsAction()` server action

2. **Server Action** (`app/(tabs)/garden/actions.ts`):
   - Authenticates user
   - Calls `syncAllUserParts(userId)`
   - Revalidates the `/garden` page cache

3. **Sync Process** (`lib/memory/parts-sync.ts`):
   - **Discovery**: Lists all markdown files in storage
   - **Parsing**: Reads each part profile, extracts metadata
   - **Database Sync**: Inserts new parts or updates existing ones

## Why It Shows 0 Parts

### Root Cause: Path Mismatch Bug

The bug was in `discoverUserParts()` function:

```typescript
// INCORRECT (Bug - Line 107 before fix)
const basePath = `${userId}/parts`; // Missing "users/" prefix

// CORRECT (After fix)
const basePath = `users/${userId}/parts`; // Matches actual storage path
```

**Impact**: The sync couldn't find any markdown files because it was looking in the wrong directory, resulting in:

- Discovery returns 0 parts
- Sync reports "0 parts synced"
- Database remains empty
- UI shows no parts

### Why Parts Exist in Agent but Not UI

1. **Agent Creates Parts**: When you interact with the agent, it creates markdown files using:

   ```typescript
   createPartProfileMarkdown → ensurePartProfileExists → storage.putText()
   ```

2. **Automatic Sync Attempt**: The creation triggers `onPartProfileChanged()` which should sync to database

3. **Sync Fails Silently**: Due to the path bug, the sync couldn't find the files

4. **Agent Still Works**: Agent reads directly from markdown storage, so it sees all parts

5. **UI Shows Nothing**: UI only reads from database, which never got populated

## The Fix

### What Was Fixed

1. **Path Correction**: Updated `discoverUserParts()` to use correct path with "users/" prefix

2. **Enhanced Logging**: Added comprehensive console logging throughout sync pipeline

3. **Immediate Sync**: Parts now sync to database immediately upon creation

### How to Verify It's Working

1. **Check Browser Console** when clicking Refresh:

   ```
   [Garden] Refresh button clicked!
   [Garden] Calling syncPartsAction...
   [Garden] syncPartsAction result: {success: true, synced: 9, failed: 0}
   [Garden] Setting 9 parts in state
   ```

2. **Check Server Logs**:
   ```
   [syncPartsAction] User authenticated: {userId}
   [discoverUserParts] Found 9 entries in storage
   [syncPartToDatabase] ✅ Created part {partId} in database
   [syncAllUserParts] Parts sync complete: 9 synced, 0 failed
   ```

## Manual Recovery Steps

If parts still don't appear after the fix:

1. **Clear Browser Cache**: Force refresh the page (Cmd+Shift+R on Mac)

2. **Manual Sync via UI**:
   - Go to `/garden`
   - Click the Refresh button
   - Wait for "✅ Synced X parts" message

3. **Check Console for Errors**:
   - Open browser DevTools (F12)
   - Look for any red error messages
   - Check Network tab for failed requests

4. **Verify Storage Access**:
   - The sync requires proper Supabase Storage permissions
   - Check if user is properly authenticated

## Technical Details

### Storage Adapter

- Uses `SupabaseStorageAdapter` for production reliability
- Bucket: `memory-snapshots`
- Service role key required for access

### Part Profile Structure

```markdown
---
id: part-abc123
name: The Protector
status: active
category: manager
emoji: 🛡️
---

# Part: The Protector

## Identity v1

- Part ID: part-abc123
- Status: active
- Category: manager

## Role v1

- Keeps us safe from emotional harm
```

### Database Schema

```sql
CREATE TABLE parts (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  status TEXT,
  category TEXT,
  role TEXT,
  visualization JSONB,
  last_charged_at TIMESTAMPTZ,
  last_charge_intensity NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Prevention & Monitoring

### Future Improvements

1. **Automatic Sync on Part Creation**: Already implemented via `onPartProfileChanged()`

2. **Better Error Handling**: Sync errors should be visible to users

3. **Background Sync Job**: Periodic sync to catch any missed updates

4. **Storage Verification**: Pre-flight check to ensure storage is accessible

5. **Integration Tests**: Test the full pipeline from creation to UI display

## Related Files

- **UI Components**:
  - `app/(tabs)/garden/page.tsx` - Parts Garden page
  - `components/garden/PartCard.tsx` - Individual part display

- **Sync Logic**:
  - `lib/memory/parts-sync.ts` - Main sync implementation
  - `app/(tabs)/garden/actions.ts` - Server action for manual sync

- **Storage**:
  - `lib/memory/snapshots/fs-helpers.ts` - Path helpers
  - `lib/memory/storage/supabase-storage-adapter.ts` - Storage implementation

- **Agent Tools**:
  - `mastra/tools/memory-markdown-tools.ts` - Part creation tools
  - `lib/memory/snapshots/updater.ts` - Profile management

## Conclusion

The Parts Garden sync issue was caused by a simple but critical path mismatch that prevented the sync process from finding markdown part files in storage. The fix has been applied, and parts should now sync correctly when:

1. Created by the agent (automatic sync)
2. Manually synced via the Refresh button

The dual storage system (markdown + database) provides flexibility but requires careful synchronization. The fix ensures this sync works reliably, making parts visible in the UI immediately after creation.
