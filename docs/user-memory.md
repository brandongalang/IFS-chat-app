# User Memory System (MVP)

This backend feature maintains an evolving, agent-readable "user memory" hub. It stores only changes between versions (JSON Patch) with periodic full checkpoints for fast reconstruction.

## Design
- Differential snapshots: JSON Patch (RFC 6902) per update
- Checkpoints: a full snapshot every N versions (default 50)
- Table: `user_memory_snapshots` (RLS-enabled)
- Reconstruction: Start from last full snapshot, apply patches forward

## Data flow
1. Daily (active users only): reconstruct current memory
2. Gather new data from last 24h (sessions, insights)
3. Summarizer generates the next memory JSON (schema-validated)
4. Compute a JSON Patch diff and insert a new snapshot (checkpoint every N)

## API
- `POST /api/cron/memory-update`
  - Header: `Authorization: Bearer <CRON_SECRET>`
  - Finds users active in last 24h, runs the update pipeline for each
  - Returns per-user result and latest version if saved

## Environment variables
- Required on server:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CRON_SECRET` (shared secret for the cron endpoint)
- Optional:
  - `OPENROUTER_API_KEY` (LLM for summarization; falls back if unset)
  - `USER_MEMORY_CHECKPOINT_EVERY` (default 50)

## Scheduling
- Primary scheduler: **Vercel Cron** configured in `vercel.json` with `0 8 * * *` (08:00 UTC daily).
- Secrets live in Vercel project settings:
  - `CRON_SECRET`: shared between the cron definition and the Next.js runtime.
  - `APP_BASE_URL` / `BASE_URL`: used by the cron handler for absolute links and logging.
- Each invocation must supply **one** of the following headers (both accepted for backwards compatibility):
  - `Authorization: Bearer <CRON_SECRET>`
  - `x-vercel-cron-secret: <CRON_SECRET>`
- GitHub Actions workflow has been retired; remove any lingering secrets or schedules referencing `.github/workflows/memory-update-cron.yml`.

## Local testing
- Apply migrations (see below)
- Run dev server, then:
  - `curl -X POST http://localhost:3000/api/cron/memory-update -H "Authorization: Bearer <CRON_SECRET>"`
  - `curl -X POST http://localhost:3000/api/cron/memory-update -H "x-vercel-cron-secret: <CRON_SECRET>"` (mirrors production header)

## Migration
- File: `supabase/migrations/006_user_memory.sql`
- Apply remotely via Supabase CLI (requires project link & token) or via Supabase Studio SQL editor

### CLI (remote)
- Pre-req: `SUPABASE_ACCESS_TOKEN` exported in shell and project linked
- Commands:
  - `supabase link` (uses token; selects project)
  - `supabase db push` (applies pending migrations)

### CLI (local)
- `supabase start` (if needed)
- `supabase db push --local`

## Implementation
- Service: `lib/memory/service.ts`
  - `reconstructMemory(userId)`
  - `generateMemoryUpdate({ userId, oldMemory, todayData })` (LLM-backed, Zod-validated)
  - `saveNewSnapshot({ userId, previous, next })`
  - `listActiveUsersSince(isoISO)` and `loadTodayData(userId, isoISO)`
- Types: `lib/memory/types.ts`
- Cron route: `app/api/cron/memory-update/route.ts`
- Auth helper: `lib/api/cron-auth.ts` (validates headers & allows dev bypass when `CRON_SECRET` unset)
