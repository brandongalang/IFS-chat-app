# Runbook: Memory Update Cron (Vercel)

This runbook explains how to operate the daily `/api/cron/memory-update` job now scheduled through Vercel Cron.

## Overview
- **Schedule:** 08:00 UTC daily (configured in `vercel.json`).
- **Endpoint:** `POST /api/cron/memory-update` (app router handler).
- **Auth:** Requires `CRON_SECRET` provided via either `Authorization: Bearer <secret>` or `x-vercel-cron-secret: <secret>` header.
- **Purpose:**
  - Reconstruct and persist `user_memory_snapshots` for users active in the last 24 hours
  - **Enhanced:** Process pending memory updates for all users with queued changes
  - **Background Processing:** Memory maintenance moved from chat requests to this dedicated worker

## Prerequisites (updated 2025-10-07)
- `CRON_SECRET` defined for Production & Preview environments in Vercel project settings.
- `SUPABASE_SERVICE_ROLE_KEY` available to the app runtime (needed for memory service writes).
- Shared Mastra provider env (`IFS_MODEL`, `IFS_TEMPERATURE`, `OPENROUTER_API_KEY`) configured so the summarizer agents can run (default model is now `x-ai/grok-4-fast`).
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
- **Response Format**: JSON includes `{ cutoff, processed, results, summaries }` where `summaries` is the count of pending updates processed.
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

## Related files
- `vercel.json`
- `lib/api/cron-auth.ts`
- `app/api/cron/memory-update/route.ts`
- `lib/memory/service.ts`
- **`lib/services/memory.ts`** - Background memory service functions
- `docs/user-memory.md`
