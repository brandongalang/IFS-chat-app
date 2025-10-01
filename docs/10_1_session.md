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
