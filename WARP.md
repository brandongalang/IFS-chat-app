# Agent Guidelines

## Critical Rules (Read First)

1. **Branch Check**: Always run `git branch --show-current` before starting work
   - If branch has existing PR or wrong task → create new branch from `main`
   - Never build new work onto a branch with open/merged PR

2. **Docs Must Pass**: All PRs require passing docs CI check
   - Update docs as you build (not after)
   - Run `node .github/scripts/docs-check.mjs` before opening PR

3. **Implementation Logs**: Track progress in `/docs/planning/implementation/`
   - Use task checkboxes to show progress
   - Never delete tasks - show evolution
   - Update frequently during coding

## Quick Navigation

**Understanding the system:**
- `/docs/README.md` - Start here for documentation structure
- `/docs/current/` - How things work now (features, architecture, ops)
- `/docs/vision/` - Long-term strategy and goals

**Finding work to do:**
- `/docs/planning/next/` - High-priority tasks ready for implementation
- `/docs/planning/backlog/` - Lower-priority future work

**During implementation:**
- `/docs/planning/implementation/` - Your progress logs
- `/docs/agent-guides/` - Task-specific detailed guides
- `docs/.docmap.json` - Maps code files to documentation

## Common Workflows

### Starting New Work
1. **Verify branch**: `git branch --show-current`
2. **If wrong/used branch**: `git checkout -b feature/new-task`
3. **Read task guide**: See Task-Specific Guides below
4. **Create implementation log**: `/docs/planning/implementation/feat-name-session-1.md`

### Before Opening PR
1. **Update docs** (see `/docs/agent-guides/documentation-workflow.md`)
2. **Run checks**: `node .github/scripts/docs-check.mjs`
3. **Ensure all CI passes**: tests, typecheck, docs
4. **Clean commit history**: meaningful messages, squash WIP commits

## Task-Specific Guides

**Load these on-demand based on your task:**

- **`/docs/agent-guides/feature-implementation.md`** - Building new features
  - Pre-implementation checklist
  - Code structure navigation
  - Implementation log template
  - Common patterns

- **`/docs/agent-guides/bug-fixes.md`** - Fixing bugs
  - Investigation process
  - Fix workflow
  - Testing requirements

- **`/docs/agent-guides/documentation-workflow.md`** - Updating docs
  - When to update
  - Step-by-step process
  - Troubleshooting docs CI

- **`/docs/agent-guides/branch-management.md`** - Branch workflows
  - Branch naming conventions
  - Common issues & solutions
  - GitHub CLI commands

- **`/docs/agent-guides/testing.md`** - Writing tests
  - Test types and examples
  - Running tests
  - Best practices

## Historical Notes

**2025-10-12**: Restructured documentation into `/docs/planning/` with priority-based organization (next/backlog/implementation). Created task-specific guides in `/docs/agent-guides/` to reduce context window usage.

**2025-10-11**: README rewrite committed directly to main by user instruction; no PR opened. This was a one-time exception for portfolio documentation updates. Subsequent work should return to standard branch/PR flow.

**2025-10-08**: Before opening or refreshing a PR, rerun the docs sweep—confirm feature docs under `docs/features/**` list every touched module (update `code_paths`, `last_updated`, etc.) and ensure the PR description matches the required template so the docs CI check passes on the first run.

**2025-10-03**: When a multi-phase plan is finished, update the relevant feature docs/runbooks before closing the workstream so the docs CI check stays green.

**2025-10-02**: Inbox APIs expose Supabase `source_id` as both `id` and `sourceId`; do not reintroduce a separate `id` column in `inbox_items_view`. Client events must send `sourceId`.

**2025-10-01**: Part-related Zod schemas are `.strict()` and expect the server to inject user identity; keep `userId` out of tool payloads/tests (updated `scripts/tests/unit/part-schemas.test.ts`).

**2025-09-26**: Remaining stacked PRs (#262, #263) diverge significantly from the new Supabase/bootstrap architecture. Prefer Option 2 — cut fresh branches from `main`, cherry-pick essential tool/schema updates, and drop legacy dependency injection patterns.

**Architecture Notes**:
- Mastra tool modules now export factory helpers (e.g., `createAssessmentTools`) that require passing the server-derived user ID; inject the profile's user ID when wiring agents.
