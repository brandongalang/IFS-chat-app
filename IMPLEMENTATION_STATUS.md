# Implementation Status: Unified Inbox System

## Current Branch
`feat/inbox-observation-cron`

## Completed Work

### Phase 1 (Bead 40) - COMPLETE ✅
**Completed:** 2025-11-08

1. **Fixed fast-json-patch Import**
   - File: `lib/memory/service.ts`
   - Changed to CommonJS imports to resolve ESM/CJS module resolution
   - All unit tests now pass

2. **Enabled Inbox Observations Cron**
   - File: `vercel.json`
   - Added `/api/cron/inbox-observations` scheduled at `15 8 * * *`

3. **Verified Implementation**
   - Cron route exists and is auth-protected
   - Manual backfill script tested successfully
   - Unit tests pass

4. **Updated Documentation**
   - File: `README.md`
   - Added bd (beads) installation instructions
   - Added common bd commands
   - Linked to beads GitHub repo

### Key Discoveries

1. **Memory Update Cron is Broken**
   - Migration 006 dropped `user_memory_snapshots` table
   - Code still references this table (will fail)
   - Context loading is disabled by default (flag off)
   - Alternative exists: `user_context_cache` materialized view

2. **Tool Migration is Complete**
   - All 4 insight research tools are DB-based
   - All 9 observation tools are DB-based
   - Zero markdown dependencies in tools
   - Ready to merge into unified system

3. **Markdown Dependency is Minimal**
   - Only `lib/memory/unified-loader.ts` reads markdown
   - Reads `overview.md` for current_focus and change_log
   - Can be replaced with DB queries

4. **Insights and Observations Overlap**
   - Both generate inbox content
   - Both appear in unified view
   - Should be consolidated

## Next Steps (Bead 41)

### Phase 0: Clean Up Broken Memory System
**Status:** Not started
**Files:**
- `vercel.json` - Remove memory-update cron
- `app/api/cron/finalize-sessions/route.ts` - NEW
- `app/api/cron/_archived/memory-update/` - Archive old

### Phase 1: Fix Unified Context Loader
**Status:** Not started
**Files:**
- `lib/memory/unified-loader.ts` - Remove markdown reads

### Phase 2-7: See Bead 41
Run `bd show ifs-chat-app-41` for full details

## Files Modified (Not Committed)

```
modified:   README.md                 # Added bd installation
modified:   lib/memory/service.ts     # Fixed fast-json-patch
modified:   vercel.json                # Added inbox cron (needs commit)
```

## Current System State

**Crons (3):**
- 08:00 - memory-update (BROKEN)
- 08:10 - generate-insights
- 08:15 - inbox-observations (NEW)

**After Phase 0 (2):**
- 08:15 - unified-inbox
- Hourly - finalize-sessions

## To Resume Work

```bash
# View current bead
bd show ifs-chat-app-41

# Check what's ready
bd ready

# See all beads
bd list
```

## Notes for Next Agent

- The unified inbox design is complete (in bead 41)
- All research is done (tools are DB-based, no blockers)
- Phase 0 can start immediately (remove broken cron)
- Each phase has clear acceptance criteria
- The architecture will be simpler and cleaner
