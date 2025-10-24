# Runbook: Memory Update Cron (Vercel)

This runbook explains how to operate the daily `/api/cron/memory-update` job now scheduled through Vercel Cron.

## Overview
- **Schedule:** 08:00 UTC daily (configured in `vercel.json`).
- **Endpoint:** `POST /api/cron/memory-update` (app router handler).
- **Auth:** Requires `CRON_SECRET` provided via either `Authorization: Bearer <secret>` or `x-vercel-cron-secret: <secret>` header.
- **Purpose:**
  - Reconstruct and persist `user_memory_snapshots` for users active in the last 24 hours
  - Finalize idle sessions (no `end_time`) and enqueue any missing `memory_updates` before summarizing
  - **Enhanced:** Process pending memory updates for all users with queued changes (cron and chat preflight share this queue)
  - **Background Processing:** Memory maintenance moved from chat requests to this dedicated worker
  - **No-op guard:** Summarizer skips mutation when no new sessions, insights, or check-ins are present to avoid empty version bumps.
  - **Context cache:** After memory updates are processed, schedule `SELECT refresh_user_context_cache();` (migration 113) in follow-up cron if fresh agent warm-start data is required.

## Prerequisites (updated 2025-10-23)
- `CRON_SECRET` defined for Production & Preview environments in Vercel project settings.
- `SUPABASE_SERVICE_ROLE_KEY` available to the app runtime (needed for memory service writes).
- Shared Mastra provider env (`IFS_MODEL`, `IFS_TEMPERATURE`, `OPENROUTER_API_KEY`) configured so the summarizer agents can run (default model is now `google/gemini-2.5-flash-preview-09-2025`).
- Vercel project has Cron feature enabled (Billing → Cron Jobs).

## Operating procedures
### Manual trigger (production)
```bash
curl -X POST https://<production-host>/api/cron/memory-update \
  -H "x-vercel-cron-secret: $CRON_SECRET"
```

### Manual trigger (preview/staging)
```bash
curl -X POST https://<preview-host>/api/cron/memory-update \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Context cache refresh (new 2025-10-15)
- After the cron completes, optionally schedule a follow-up task (cron or manual) to refresh the PRD warm-start cache:
  ```sql
  select refresh_user_context_cache();
  ```
- Running the refresh immediately after migrations 111/112 or large data backfills ensures the agent context stays in sync with the PRD tables without waiting for the next automated cycle.

### Secret rotation / config drift
1. Generate new random secret (e.g., `openssl rand -hex 32`).
2. Update Vercel project Environment Variables (`CRON_SECRET`) for Production and Preview.
3. Redeploy or trigger redeploy so the runtime picks up the new value.
4. Update any Terraform/infra notes storing the canonical secret value.
5. Optional: keep old secret valid for 5 minutes by setting both headers during the overlap.
6. When changing model/provider defaults, update the same env vars in Vercel to keep cron runs aligned with interactive agents.

### Monitoring
- Add Vercel Cron notifications (Project → Monitoring → Cron Jobs) to alert on failures.
- Inspect application logs (`vercel logs <deployment-url>`) for entries tagged `memory-update`, `MEMORY`, or `Cron auth`.
- **Response Format**: JSON includes `{ cutoff, processed, results, summaries, finalizedSessions }` where `summaries` counts queue items processed and `finalizedSessions` reports closed sessions/enqueues.
- Track snapshots in Supabase: `select user_id, version, applied_at from user_memory_snapshots order by applied_at desc limit 5;`
- **Performance**: Chat latency improved since memory maintenance no longer blocks request processing.

## Triage checklist
1. **403 / Unauthorized**
   - Confirm the header matches `CRON_SECRET` exactly.
   - If using Vercel Cron, ensure the job defines `headers: { "x-vercel-cron-secret": "${CRON_SECRET}" }` (if using advanced config).
2. **500 / Set session failures**
   - Review logs for Supabase errors; verify service role key is present.
3. **No snapshots written**
   - Check for `no-activity` responses in the cron payload; ensure active users exist.
   - Validate `listActiveUsersSince` cutoff by running the helper query manually.
4. **Rate limiting**
   - If the job processes many users, consider batching or introducing short delays between iterations.

## Fallback plan
- Temporarily disable the Vercel Cron job (toggle off in dashboard).
- Manually run `npm run scripts:memory-update -- --user <uuid>` (if script exists) or execute the curl command per user.
- Communicate downtime in #ops and log the manual run results (versions, errors).

## Memory V2 Storage (added 2025-10-13)

The cron job manages Memory V2 markdown files stored in Supabase Storage:
- **Storage bucket**: `memory-snapshots` (created by migration 110)
- **Configuration**: None required - uses `SUPABASE_SERVICE_ROLE_KEY` for storage access
- **Migration**: Apply `supabase/migrations/110_memory_snapshots_bucket.sql` to create bucket with RLS policies
- **File structure**: `users/{userId}/parts/{partId}/profile.md`, `users/{userId}/overview.md`, etc.
- **Service role**: Required for agent operations (bypasses RLS for system access)

## Related files
- `vercel.json`
- `lib/api/cron-auth.ts`
- `app/api/cron/memory-update/route.ts`
- `lib/memory/service.ts`
- **`lib/services/memory.ts`** - Background memory service functions
- `lib/memory/queue.ts`
- `lib/memory/markdown/logging.ts` - Markdown write logging with integrity tracking (added 2025-01-11)
- `app/api/memory/preflight/route.ts`
- `docs/user-memory.md`
- `supabase/migrations/110_memory_snapshots_bucket.sql` - Storage bucket setup (added 2025-10-13)
- `supabase/migrations/111_prd_core_tables.sql` - PRD schema foundations (parts_v2, sessions_v2, observations, timeline)
- `supabase/migrations/112_prd_context_views.sql` - Parts/timeline views and initial `user_context_cache` materialized view
- `supabase/migrations/113_prd_context_view_refinements.sql` - Refined context views, extended cache payload, and resilient refresh helper
