# Agent Guidelines

- Prefer GitHub CLI (`gh`) for creating and updating pull requests from this repository.
- Document any deviations from standard workflows in this file so future agents stay aligned.
- Before opening a PR, update the mapped docs for any changed modules (run `npm run lint` and check `docs/features/**`, `docs/user-memory.md`, runbooks, etc.) so the `docs` CI check passes without manual retries.
- Mastra tool modules now export factory helpers (e.g., `createAssessmentTools`) that require passing the server-derived user ID; inject the profile's user ID when wiring agents.
- 2025-09-26: Remaining stacked PRs (#262, #263) diverge significantly from the new Supabase/bootstrap architecture. Prefer Option 2 — cut fresh branches from `main`, cherry-pick essential tool/schema updates, and drop legacy dependency injection patterns.
- 2025-10-01: Part-related Zod schemas are `.strict()` and expect the server to inject user identity; keep `userId` out of tool payloads/tests (updated `scripts/tests/unit/part-schemas.test.ts`).
- 2025-10-02: Inbox APIs expose Supabase `source_id` as both `id` and `sourceId`; do not reintroduce a separate `id` column in `inbox_items_view`. Client events must send `sourceId`.
- 2025-10-03: When a multi-phase plan (e.g., session logs like `docs/10_1_session.md`) is finished, update the relevant feature docs/runbooks before closing the workstream so the docs CI check stays green.
