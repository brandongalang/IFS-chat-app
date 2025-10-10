# User Memory System (MVP)

This backend feature maintains an evolving, agent-readable "user memory" hub. It stores only changes between versions (JSON Patch) with periodic full checkpoints for fast reconstruction.

## Design
- Differential snapshots: JSON Patch (RFC 6902) per update
- Checkpoints: a full snapshot every N versions (default 50)
- Table: `user_memory_snapshots` (RLS-enabled)
- Reconstruction: Start from last full snapshot, apply patches forward

## Data flow
1. **Event-time enqueue**: When chats end, check-ins submit, or onboarding completes, we upsert lightweight rows into `memory_updates` using `(user_id, kind, ref_id)` uniqueness for idempotency.
2. **Chat preflight**: On chat open we call `POST /api/memory/preflight` to summarize pending queue items immediately so the agent starts with fresh context.
3. **Nightly finalize**: The daily cron closes stale sessions (idle beyond the configured window), enqueues any missing updates, and gathers 24h activity for legacy `processed` fallbacks.
4. **Summarizer**: `summarizePendingUpdates` consumes the queue (all users or a single user), generates changelog entries, and marks processed rows.
5. **Snapshot generation**: For active users we reconstruct memory, feed new data to the LLM, compute a JSON Patch diff, and insert a new snapshot (checkpoint every N).
6. **Queue cleanup**: `markUpdatesProcessed` remains during the transition to keep legacy flags in sync while the queue-driven flow stabilizes.

## API
- `POST /api/cron/memory-update`
  - Header: `Authorization: Bearer <CRON_SECRET>`
  - Finds users active in last 24h, runs the update pipeline for each
  - **Enhanced**: Finalizes stale sessions, enqueues queue entries, and processes pending memory updates for all users
  - Returns per-user result, latest version if saved, queue summary, and change-log stats
- `POST /api/memory/preflight`
  - Authenticated user endpoint invoked before chat agent boot
  - Checks for pending queue items and, if present, runs a scoped `summarizePendingUpdates({ userId })`
  - Returns `{ ok, processed, pending }` so the UI can warn if preflight failed

## Environment variables (updated 2025-10-07)
- Required on server:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CRON_SECRET` (shared secret for the cron endpoint)
- Optional:
  - `OPENROUTER_API_KEY` (LLM for summarization; falls back if unset)
  - `IFS_MODEL`, `IFS_TEMPERATURE` (shared Mastra provider config; now defaults to `grok-4-fast` via OpenRouter)
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

## Implementation (updated 2025-01-11)
- **Background Services**: `lib/services/memory.ts`
  - `scaffoldUserMemory({ userId })` - ensures memory scaffolding exists
  - `summarizePendingUpdates({ userId?, limit? })` - processes pending updates for users
  - `finalizeStaleSessions({ idleMinutes? })` - closes idle sessions and enqueues queue items before snapshotting
- **Overview Snapshot Loader**: `lib/memory/overview.ts`
  - `loadOverviewSnapshot(userId)` calls `ensureOverviewExists` and plucks curated anchors for prompt hydration
  - `formatOverviewFragments(fragments)` renders anchored markdown sections, ensuring empty bodies degrade gracefully
- **Markdown Logging**: `lib/memory/markdown/logging.ts` (added 2025-01-11)
  - `computeMarkdownHash(text)` - computes SHA-256 hashes for integrity tracking
  - `inferEntityContext(filePath, userId)` - extracts entity type/ID from file paths, strips .md extensions
  - `logMarkdownMutation({ userId, filePath, mode, text, beforeHash, afterHash, warnings })` - logs all markdown write operations with non-fatal error handling
  - All markdown writes (append/replace/create) emit `profile_update` events with integrity metadata for reconstruction
- Core Service: `lib/memory/service.ts`
  - `reconstructMemory(userId)`
  - `generateMemoryUpdate({ userId, oldMemory, todayData })` (LLM-backed, Zod-validated)
  - `saveNewSnapshot({ userId, previous, next })`
  - `listActiveUsersSince(isoISO)` and `loadTodayData(userId, isoISO)`
  - `listUnprocessedUpdates(userId)` now logs Supabase error metadata and throws friendly messages so tool output surfaces readable failures
  - `markUpdatesProcessed({ userId, sessions, insights, checkIns })` - marks items as processed after memory updates are written
- **Queue utilities**: `lib/memory/queue.ts` (`enqueueMemoryUpdate`) and the `memory_updates` schema (now with `ref_id` unique index) handle idempotent event-time ingestion.
- **Chat preflight**: `app/api/memory/preflight/route.ts` powers the immediate summarize-on-open flow used by `useChatSession`.
- **Agent tooling**: `mastra/tools/memory-markdown-tools.ts` exposes read + scoped write helpers (overview changelog, sections, part notes, part profile creation) shared by chat and background agents.
  - `lib/memory/snapshots/updater.ts` provides `ensurePartProfileExists` which returns `{ path, created }` atomically to eliminate TOCTOU races (updated 2025-01-11)
- Types: `lib/memory/types.ts`
- Cron route: `app/api/cron/memory-update/route.ts`
- **Chat Integration**: Memory maintenance removed from `app/api/chat/route.ts` - now handled by background workers
- Auth helper: `lib/api/cron-auth.ts` (validates headers & allows dev bypass when `CRON_SECRET` unset)
- Supabase client access flows through `lib/supabase/clients.ts`, which exposes shared helpers (`getUserClient`, `getServiceClient`, `getBrowserSupabaseClient`) suitable for server, service-role, and browser usage.
