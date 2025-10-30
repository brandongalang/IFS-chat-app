# Runbook: Inbox Observation Generation Job

This runbook captures how to execute and monitor the inbox observation generation workflow that hydrates `inbox_observations` and related events.

## Overview
- Script: `npm run inbox:generate`
- Purpose: generate fresh observations for a list of users, respecting inbox queue capacity and dedupe windows
- Outputs:
  - New rows in `inbox_observations`
  - Delivery + confirmation/dismissal events in `observation_events`
  - Job metadata in `inbox_job_runs`
  - Tool telemetry in `inbox_observation_telemetry`
  - Trace enrichment is optional; the engine now skips markdown/session lookups when the job passes `traceResolvers: null` (useful for dry runs or rate-limited environments).

## Prerequisites
- Environment variables loaded (e.g., `.env.local`):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - Mastra provider settings (`OPENROUTER_API_KEY`, `IFS_MODEL`, `IFS_TEMPERATURE`)
- Supabase migrations up to `107_inbox_observation_telemetry.sql`
  - Includes migrations 105 (inbox_message_events) and 106 (inbox_observations, observation_events, inbox_job_runs)
- Optional: pass `--queue` or `--window` flags to override defaults (3 slots / 14-day dedupe)

## Usage
```bash
npm run inbox:generate -- --limit 10
npm run inbox:generate -- --user <uuid>
npm run inbox:generate -- --queue 5 --window 21
```
- `--user <uuid>`: process a single user
- `--limit <n>`: process first `n` users (ordered by `users.created_at`)
- `--queue <n>`: override queue capacity per user
- `--window <n>`: override dedupe lookback (days)

## Monitoring & Telemetry
- Job summary printed to stdout with inserted/skipped/error counts
- `select * from inbox_job_runs order by started_at desc limit 5;`
- `select * from inbox_observation_telemetry order by created_at desc limit 20;`
- `select * from inbox_observations order by created_at desc limit 5;`
- Inspect observation events: `select * from observation_events order by created_at desc limit 10;`

## Failure recovery
1. If the script exits early, re-run with the same flags; dedupe logic prevents duplicate observations.
2. For persistent Supabase failures, confirm credentials and RLS policies (tables: `inbox_observations`, `observation_events`, `inbox_job_runs`).
3. Use `--user` to isolate problematic records before scaling to the full user list.

## Manual API Trigger (Server)
The Inbox Observation Engine can also be triggered per-user via a Next.js API route.

### Endpoint
- `POST /api/inbox/generate`

### Authentication
- Must be signed in.
- Generating for yourself is always allowed.
- Cross-user generation requires a service-role principal:
  - `user.app_metadata.service_role === true`, or
  - `user.app_metadata.roles` includes `'service_role'`, or
  - `user.role === 'service_role'`

### RLS and Service Role
- Inserts into `public.inbox_observations` require `auth.role() = 'service_role'` per RLS policy.
- The API route authenticates the caller with the user client but performs all DB work with a server-only service-role client.
- The service-role key is never exposed to the browser.

### Request Body
```json
{
  "userId": "<uuid>" // optional; defaults to authenticated user's ID
}
```
- Providing a different `userId` requires service-role authorization (see above).

### Rate Limiting
- 24-hour cooldown between manual syncs per user.
- Enforced by checking recent `inbox_observations` with `metadata->>'trigger' = 'manual'`.

### Responses
**200 OK**:
```json
{
  "status": "success" | "skipped" | "error",
  "inserted": [
    {
      "id": "uuid",
      "status": "pending",
      "semanticHash": "sha256...",
      "createdAt": "2025-10-30T...",
      "title": "Observation title"
    }
  ],
  "queueStatus": {
    "total": 3,
    "available": 2,
    "limit": 3,
    "hasCapacity": true
  },
  "reason": "queue_full" | "no_candidates" | "persistence_failure" | undefined
}
```
- `status: "success"`: new observations were inserted.
- `status: "skipped"`: no capacity or nothing new to insert.
- `status: "error"`: engine ran but failed to persist (rare; see server logs).

**401 Unauthorized**: not signed in.

**403 Forbidden**: tried cross-user generation without service-role.

**429 Too Many Requests**: cooldown active (wait 24 hours).

**500 Internal Server Error**:
- If `SUPABASE_SERVICE_ROLE_KEY` is missing on the server, the route returns 500 (with an actionable message in non-production).

### Operational Notes
- Queue capacity: default 3 (`queueLimit: 3`).
- Dedupe window: default 14 days (`dedupeWindowDays: 14`).
- Manual API trigger uses `metadata: { trigger: "manual", source: "api" }`.

### Example Usage

**Self-generation:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -b "sb:token=<your_session_cookie>" \
  https://<your-domain>/api/inbox/generate
```

**Cross-user (service-role principal required):**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -b "sb:token=<service_role_session_cookie>" \
  -d '{"userId":"<target-user-uuid>"}' \
  https://<your-domain>/api/inbox/generate
```

### UI Integration
The inbox UI includes a "Sync Inbox" button that:
- Calls this endpoint automatically
- Disables when queue is full
- Enforces 24-hour cooldown client-side
- Shows loading state during generation
- Auto-reloads feed on success

## Related Updates
- **PR #310**: Improved type safety and code quality in `lib/inbox/__tests__/chat-bridge.test.ts` (chat-bridge module tests, not observation job related)
