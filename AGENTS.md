# Agent Guidelines

## Branch Management
- **IMPORTANT**: Before starting any new work, verify you're on a clean branch appropriate for the task:
  1. Check current branch with `git branch --show-current`
  2. If the current branch was used for a different PR or feature, create a new branch from `main`
  3. Never build new work onto a branch that already has an open/merged PR
  4. Use descriptive branch names: `feature/description`, `fix/description`, or `refactor/description`
- Prefer GitHub CLI (`gh`) for creating and updating pull requests from this repository.
- Document any deviations from standard workflows in this file so future agents stay aligned.
- **2025-10-11**: README rewrite committed directly to main by user instruction; no PR opened. This was a one-time exception for portfolio documentation updates. Subsequent work should return to standard branch/PR flow.

## Documentation Workflow (CRITICAL)
**Before opening any PR, documentation MUST be updated to pass the `docs` CI check.**

### When to Update Docs
- **ALWAYS update docs** when changes affect:
  - Behavior, data flow, or system design
  - User-facing features or UI/UX
  - API contracts, database schemas, or data models
  - Configuration or environment variables
  - Tool/agent capabilities or workflows

- **SKIP docs only when** the change is purely non-functional:
  - Code formatting or style fixes
  - Comment updates
  - Test refactors that don't change behavior
  - Dependency version bumps without API changes
  - **If skipping docs, add the `docs:skip` label and justify in the PR description**

### Documentation Update Checklist
1. **Identify affected areas** using `docs/.docmap.json`:
   - Run `git diff main...HEAD --name-only` to see changed files
   - Match changed paths against docmap patterns
   - Update ALL mapped docs that correspond to changed code

2. **Update feature docs** (`docs/features/**`):
   - Add PR number to `related_prs` list
   - Update `last_updated` date (YYYY-MM-DD format)
   - Add/update relevant sections (e.g., "How it works", "UI/UX notes", "Data model")
   - Verify all changed files are listed in `code_paths`

3. **Update runbooks** (`docs/runbooks/**`) when changing:
   - Operational procedures
   - Deployment workflows
   - Cron jobs or scheduled tasks
   - Database migrations or data maintenance

4. **Create new docs** for:
   - New features or major subsystems
   - Cross-cutting concerns (e.g., mobile responsiveness, accessibility)
   - Add corresponding entries to `docs/.docmap.json`

5. **Verify docs CI will pass**:
   - Run `node .github/scripts/docs-check.mjs` locally (requires BASE_SHA and HEAD_SHA env vars)
   - Or push and let GitHub Actions validate
   - Fix any violations before requesting review

### Documentation Standards
- Use clear, concise language
- Include code examples where helpful
- Link to related PRs, issues, and other docs
- Keep frontmatter metadata up to date
- Follow existing doc structure and conventions
- Mastra tool modules now export factory helpers (e.g., `createAssessmentTools`) that require passing the server-derived user ID; inject the profile's user ID when wiring agents.
- 2025-09-26: Remaining stacked PRs (#262, #263) diverge significantly from the new Supabase/bootstrap architecture. Prefer Option 2 — cut fresh branches from `main`, cherry-pick essential tool/schema updates, and drop legacy dependency injection patterns.
- 2025-10-01: Part-related Zod schemas are `.strict()` and expect the server to inject user identity; keep `userId` out of tool payloads/tests (updated `scripts/tests/unit/part-schemas.test.ts`).
- 2025-10-02: Inbox APIs expose Supabase `source_id` as both `id` and `sourceId`; do not reintroduce a separate `id` column in `inbox_items_view`. Client events must send `sourceId`.
- 2025-10-03: When a multi-phase plan (e.g., session logs like `docs/10_1_session.md`) is finished, update the relevant feature docs/runbooks before closing the workstream so the docs CI check stays green.
- 2025-10-08: Before opening or refreshing a PR, rerun the docs sweep—confirm feature docs under `docs/features/**` list every touched module (update `code_paths`, `last_updated`, etc.) and ensure the PR description matches the required template so the docs CI check passes on the first run.
