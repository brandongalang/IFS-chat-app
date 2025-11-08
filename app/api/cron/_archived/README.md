# Archived Cron Routes

This directory contains legacy cron routes that are no longer active but kept for historical reference.

## memory-update (Archived Nov 8, 2025)

**Reason for Archival:**
- Migration 006 dropped the `user_memory_snapshots` table
- The route had a hard dependency on this table
- Execution would always fail with table not found error
- Functionality was replaced by `finalize-sessions` cron

**Historical Purpose:**
- Daily (8:00 AM) memory update cron job
- Reconstructed user memory from snapshots and patches
- Generated daily memory updates
- Saved new memory snapshots

**Replacement:**
- See `app/api/cron/finalize-sessions/route.ts`
- Runs hourly instead of daily
- Closes stale sessions and enqueues memory update jobs

**Related Bead:**
- Unified Inbox System (ifs-chat-app-41, Phase 0)
