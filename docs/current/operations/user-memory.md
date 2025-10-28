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
- `GET /api/cron/memory-update` (also accepts `POST` for manual triggers)
  - Header: `Authorization: Bearer <CRON_SECRET>`
  - Finds users active in last 24h, runs the update pipeline for each
  - **Enhanced**: Finalizes stale sessions, enqueues queue entries, and processes pending memory updates for all users
  - Returns per-user result, latest version if saved, queue summary, and change-log stats
- `GET /api/cron/update-digest` (also accepts `POST`)
  - Header: `Authorization: Bearer <CRON_SECRET>`
  - Iterates over users with pending `memory_updates`, executes Mastra summarizer workflow, and records digest telemetry
  - Returns `{ processed, results }` including per-user success or error payloads for observability
- `POST /api/memory/preflight`
  - Authenticated user endpoint invoked before chat agent boot
  - Checks for pending queue items and, if present, runs a scoped `summarizePendingUpdates({ userId })`
  - Returns `{ ok, processed, pending }` so the UI can warn if preflight failed

## Environment variables (updated 2025-10-23)
- Required on server:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (used for Memory V2 Supabase Storage access and database operations)
  - `CRON_SECRET` (shared secret for the cron endpoint)
- Optional:
  - `OPENROUTER_API_KEY` (LLM for summarization; falls back if unset)
  - `IFS_MODEL`, `IFS_TEMPERATURE` (shared Mastra provider config; now defaults to `google/gemini-2.5-flash-preview-09-2025` via OpenRouter)
  - `USER_MEMORY_CHECKPOINT_EVERY` (default 50)
  - `MEMORY_AGENTIC_V2_ENABLED` (default true) - Enables Memory V2 markdown-based storage
  - `TARGET_ENV` / `NEXT_PUBLIC_TARGET_ENV` (set to `prod` for local development against production Supabase; production deployments should not set these)
  - `NEXT_PUBLIC_PROD_SUPABASE_URL`, `NEXT_PUBLIC_PROD_SUPABASE_ANON_KEY`, `PROD_SUPABASE_SERVICE_ROLE_KEY` (production credentials for local development when targeting production)
  - `MEMORY_STORAGE_ADAPTER` (defaults to `supabase`; set to `local` to run filesystem-backed tests and tooling)
  - `MEMORY_LOCAL_ROOT` (optional override when using the local adapter; default `.data/memory-snapshots`)

## Memory V2 Storage (updated 2025-10-14)
The Memory V2 system stores part profiles, relationships, and user context as markdown files via the shared storage adapter:
- **Storage backend**: Defaults to Supabase Storage (bucket: `memory-snapshots`); set `MEMORY_STORAGE_ADAPTER=local` for filesystem-backed tests
- **Configuration**: Supabase mode works automatically with `SUPABASE_SERVICE_ROLE_KEY`; local mode respects `MEMORY_LOCAL_ROOT`
- **Migration**: See `supabase/migrations/110_memory_snapshots_bucket.sql` for bucket setup with RLS policies
- **File structure**: `users/{userId}/parts/{partId}/profile.md`, `users/{userId}/overview.md`, etc.
- **Service role**: Required for agent operations (bypasses RLS for system access)
- **2025-10-17 PRD cutover**: Interactive agents and background jobs no longer write to markdown. Update digests and change logs are persisted via Supabase `observations` / `timeline_events`, while markdown snapshots remain available for read-only hydration during the transition.

## Scheduling
- Primary scheduler: **Vercel Cron** configured in `vercel.json`.
  - 08:00 UTC — `/api/cron/memory-update`
  - 08:10 UTC — `/api/cron/update-digest`
  - 08:30 UTC — `/api/cron/generate-insights` (insights pipeline consumes the fresh digests)
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

## Migrations
### Core Migrations (updated 2025-10-15)
- `supabase/migrations/006_user_memory.sql` — legacy snapshots + queue baseline
- `supabase/migrations/111_prd_core_tables.sql` — introduces `parts_v2`, `sessions_v2`, `observations`, `part_relationships_v2`, `timeline_events` plus RLS and supporting indexes
- `supabase/migrations/112_prd_context_views.sql` — defines `parts_display`, `timeline_display`, `user_context_cache`, and the `refresh_user_context_cache()` helper
- `supabase/migrations/113_prd_context_view_refinements.sql` — rebuilds the context views, expands the cached payload, and adds supporting indexes + resilient refresh helper
- After applying migrations 111-113, run `SELECT refresh_user_context_cache();` once to hydrate the materialized view before enabling the agent warm start flow.
- Apply remotely via Supabase CLI (requires project link & token) or via Supabase Studio SQL editor

###Note on Inbox Migrations (105-106)
Migrations `105_inbox_message_events.sql` and `106_inbox_observations.sql` are inbox-related and do not affect the user memory system. They are tracked here due to broad `.docmap.json` path matching.

### CLI (remote)
- Pre-req: `SUPABASE_ACCESS_TOKEN` exported in shell and project linked
- Commands:
  - `supabase link` (uses token; selects project)
  - `supabase db push` (applies pending migrations)

### CLI (local)
- `supabase start` (if needed)
- `supabase db push --local`

## Implementation (updated 2025-10-13)
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
- **Storage Adapter** (updated 2025-10-14, PR #316): `lib/memory/storage/`
  - `supabase-storage-adapter.ts` - Supabase Storage implementation with **recursive directory listing** (detects folders by `id === null` and descends into subdirectories)
  - `local-storage-adapter.ts` - Legacy local filesystem implementation (deprecated; logs a runtime warning)
  - `adapter.ts` - StorageAdapter interface defining `putText`, `getText`, `exists`, `list`, `delete` methods
  - Adapter selection now respects `MEMORY_STORAGE_ADAPTER`; Supabase remains the production default while `local` enables filesystem tooling/tests
  - Multi-environment support: Uses `TARGET_ENV`/`NEXT_PUBLIC_TARGET_ENV` to switch between local and production Supabase credentials (see `lib/supabase/config.ts`)
  - **Recursive listing fix**: The `list()` method now properly discovers nested files like `users/{userId}/parts/{partId}/profile.md`, fixing Parts Garden detection issues
- **Parts sync utility** (added 2025-10-12, enhanced 2025-01-14): `lib/memory/parts-sync.ts`
  - `discoverUserParts(userId)` finds markdown part profiles
  - `syncPartToDatabase(userId, partId)` updates/inserts DB record from markdown, preferring frontmatter metadata when available
  - Syncs emoji from YAML frontmatter to database visualization field
  - Backward compatible with legacy parts without frontmatter (parses from sections)
  - **Enhanced**: Now prefers YAML frontmatter data when available, falls back to section parsing for legacy parts
  - **Emoji sync**: Extracts emoji from frontmatter and syncs to database visualization field
  - `syncAllUserParts(userId)` iterates through all detected part profiles
  - `onPartProfileChanged(userId, partId)` hook automatically called on part creation/update to sync to database immediately
  - Event-driven integration: `lib/memory/snapshots/updater.ts` calls the sync hook in `ensurePartProfileExists`, `onPartCreated`, and `onPartUpdated`
  - Manual sync fallback: `app/(tabs)/garden/actions.ts` exposes `syncPartsAction` for user-triggered refresh in Garden UI
- **YAML Frontmatter Support** (added 2025-01-14, PR #311): `lib/memory/markdown/frontmatter.ts`
  - Part profiles now include YAML frontmatter with structured metadata (id, name, emoji, category, status, tags, timestamps)
  - `parsePartMarkdown(text)` extracts frontmatter + content using gray-matter
  - `buildPartMarkdownWithFrontmatter(frontmatter, content)` combines metadata + narrative
  - `updatePartFrontmatter(text, updates)` updates metadata while preserving content
  - Backward compatible: returns null frontmatter if not present, falls back to section parsing
- **Parts Repository API** (added 2025-01-14): `lib/memory/parts-repository.ts`
  - Repository-style APIs for querying and updating parts
  - `listParts(userId, filters)` - query by category, status, tag, name, limit
  - `readPart(userId, partId)` - get complete part with frontmatter + sections
  - `updatePartFrontmatter(userId, partId, updates)` - update metadata
  - `updatePartSection(userId, partId, anchor, change)` - edit specific sections
  - Uses StorageAdapter (works with Supabase Storage or local filesystem)
- Types: `lib/memory/types.ts`
- Cron route: `app/api/cron/memory-update/route.ts`
- **Chat Integration**: Memory maintenance removed from `app/api/chat/route.ts` - now handled by background workers
- Auth helper: `lib/api/cron-auth.ts` (validates headers & allows dev bypass when `CRON_SECRET` unset)
- Supabase client access flows through `lib/supabase/clients.ts`, which exposes shared helpers (`getUserClient`, `getServiceClient`, `getBrowserSupabaseClient`) suitable for server, service-role, and browser usage.
