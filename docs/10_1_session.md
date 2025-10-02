# Inbox Observation Tools – 2025-10-01

## Phase 1 Decisions

- `md.list` / `md.search` / `md.read` APIs will enforce user-scoped roots (`users/{userId}/**`).
- Caps: `md.search` returns at most 50 matches per call; `md.read` returns up to 8 KB per page.
- Search defaults to case-insensitive substring; regex is opt-in via `regex: true` with optional `flags`.
- Search timeout per invocation: 500 ms; subsequent phases will reuse shared timeout/error helpers.
- Sessions & check-ins searches default to 14-day lookback and leverage Postgres FTS indexes.

## Phase 1 Implementation Notes

- Added `lib/inbox/search/types.ts` exporting contracts for markdown, session, and check-in list/search/read helpers plus telemetry client signature.
- Added `lib/inbox/search/guards.ts` with clamp helpers (`normalizeMatchLimit`, `normalizePageSize`, `normalizeTimeoutMs`, `normalizeContextLines`) and regex validation to enforce the caps above.
- Regex support excludes `g` flag, auto-adds `i` when `ignoreCase` is true, and limits usable flags to `imsuy` to avoid unexpected backtracking.
- Telemetry hook `recordTelemetry` swallows failures so tooling never breaks the agent flow; actual destinations will be wired in Phase 5.
- Unit coverage lives in `scripts/tests/unit/inbox-search-guards.test.ts` and is now part of `npm run test:unit`.
## Phase 2 Progress (Markdown Finder)

- Implemented `lib/inbox/search/markdown.ts` with `listMarkdownFiles`, `searchMarkdown`, and `readMarkdown`, enforcing user-scoped paths, prefix/glob filters, and timeout-limited scanning.
- Added `minimatch` dependency for glob matching; search honors substring by default with optional regex plus 2-line context.
- New unit coverage in `scripts/tests/unit/markdown-search.test.ts` exercises list, search, and chunked reads against the local storage adapter.


## Phase 3 Plan (Sessions & Check-ins Search)

- Introduce `lib/inbox/search/sessions.ts` and `lib/inbox/search/checkins.ts` modules exposing `searchSessions`, `listSessions`, `getSessionDetail`, `searchCheckIns`, `listCheckIns`, and `getCheckInDetail`.
- Add Supabase FTS migrations (or reuse existing indexes) to support ranked search over session summaries/messages and check-in reflections. Ensure 14-day lookback defaults with configurable overrides.
- Telemetry: emit `sessions.search`, `checkins.search`, `sessions.get`, `checkins.get` events with duration and result counts.
- Testing: create fixture-based unit tests under `scripts/tests/unit` stubbing Supabase client responses (success, empty, error) and verifying lookback/field filtering.

## Phase 4 Plan (Agent Integration)

- Update `mastra/agents/inbox-observation.ts` to register the new search tools and guide prompt usage (list → search → read flow).
- Extend `lib/inbox/observation-engine.ts` to call markdown/sessions/check-ins helpers and capture trace metadata for dedupe/scoring.
- Ensure queue gating remains intact; persist observation evidence references (markdown path + line, sessionId, checkInId) in observation metadata.
- Validation: workflow unit tests with mocked tool responses plus golden samples for end-to-end observation generation.

## Phase 5 Progress (Telemetry & Rollout)

- Added Supabase table `inbox_observation_telemetry` plus a resilient telemetry client (`lib/inbox/search/telemetry.ts`) that records tool usage, durations, metadata, and failure reasons for all observation search helpers.
- `createObservationResearchTools` now wires telemetry automatically and resolves user IDs at execution time; Edge/runtime builds use safe fallbacks while telemetry writes run via service-role credentials.
- Runbook updates:
  - Use `npm run inbox:generate` for manual dry-runs; telemetry can be reviewed via `SELECT * FROM inbox_observation_telemetry ORDER BY created_at DESC LIMIT 50;` for quick audits.
  - Vercel/Supabase dashboards can visualize per-tool counts by grouping on `tool` and `date_trunc('day', created_at)`.
- Staging checklist: ensure cron dry-run populates telemetry, verify queue capacity behaviour, and monitor `observation_events` alongside telemetry rows before production enablement.