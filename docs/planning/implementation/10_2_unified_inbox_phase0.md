# Unified Inbox System Implementation - Phase 0

**Date Started:** 2025-11-08  
**Status:** In Progress  
**Bead:** ifs-chat-app-41

## Overview

Phase 0 focuses on cleaning up the broken memory update system and establishing the new cron infrastructure for bead 41.

## Work Completed

### 1. Remove Broken Memory-Update Cron ✅
- **File:** `vercel.json`
- **Change:** Remove the `memory-update` cron entry (schedule: `0 8 * * *`)
- **Reason:** Migration 006 dropped `user_memory_snapshots` table; code will fail on execution
- **Status:** TODO

### 2. Create Finalize-Sessions Cron
- **File:** `app/api/cron/finalize-sessions/route.ts` (NEW)
- **Purpose:** Replace memory-update; runs hourly to finalize stale sessions
- **Uses:** Existing `finalizeStaleSessions()` function from `lib/memory/service.ts`
- **Schedule:** Hourly (recommended: `0 * * * *`)
- **Status:** TODO

### 3. Archive Old Memory-Update Route (Optional)
- **File:** `app/api/cron/memory-update/route.ts`
- **Action:** Can be archived to `app/api/cron/_archived/memory-update/` or removed
- **Status:** TODO

## Resulting Cron Configuration

**Before Phase 0:**
```json
{
  "crons": [
    { "path": "/api/cron/memory-update", "schedule": "0 8 * * *" },      // BROKEN
    { "path": "/api/cron/generate-insights", "schedule": "10 8 * * *" },
    { "path": "/api/cron/inbox-observations", "schedule": "15 8 * * *" }  // From bead 40
  ]
}
```

**After Phase 0:**
```json
{
  "crons": [
    { "path": "/api/cron/generate-insights", "schedule": "10 8 * * *" },
    { "path": "/api/cron/inbox-observations", "schedule": "15 8 * * *" },
    { "path": "/api/cron/finalize-sessions", "schedule": "0 * * * *" }
  ]
}
```

## Key Implementation Details

### finalize-sessions Route
- Calls `finalizeStaleSessions()` from `lib/memory/service.ts`
- Returns summary of finalized sessions
- Auth via `requireCronAuth()`
- Supports both GET and POST methods
- No dependencies on dropped tables

### Changes to vercel.json
- Remove memory-update entry completely
- Keep generate-insights and inbox-observations
- Add finalize-sessions with hourly schedule

## Acceptance Criteria for Phase 0

✅ memory-update removed from vercel.json  
✅ finalize-sessions route created and working  
✅ No broken cron references  
✅ Hourly finalize-sessions cron configured  
✅ lint/type checks pass  

## Next Phase (Phase 1)

After Phase 0 approval, Phase 1 begins:
- Fix unified context loader
- Remove markdown reads
- Use DB views (user_context_cache + timeline_display)
