# Agent Guidelines

We track work in Beads instead of Markdown. Run `bd quickstart` to see how.

## Branch Management
- **IMPORTANT**: Before starting any new work, verify you're on a clean branch appropriate for the task:
  1. Check current branch with `git branch --show-current`
  2. If the current branch was used for a different PR or feature, create a new branch from `main`
  3. Never build new work onto a branch that already has an open/merged PR
  4. Use descriptive branch names: `feature/description`, `fix/description`, or `refactor/description`
- Prefer GitHub CLI (`gh`) for creating and updating pull requests from this repository.
- Document any deviations from standard workflows in this file so future agents stay aligned.
- **2025-10-11**: README rewrite committed directly to main by user instruction; no PR opened. This was a one-time exception for portfolio documentation updates. Subsequent work should return to standard branch/PR flow.

## Beads Workflow & Delivery Cadence
- Every bead should progress through **plan → implement → validate → ship** before picking up the next task.
- When starting a bead, capture a todo list (`bd create`, `TodoWrite`) so each subtask is traceable.
- While implementing, keep work on a dedicated branch. Stage commits incrementally; avoid large "mega" commits that span multiple beads.
- Update bead status in Beads as you move through the workflow (plan/implement/validate/ship). The `.beads` database is kept local and not committed to git.
- **Testing cadence**:
  - Run targeted checks (e.g., `npm run migrations:verify`, unit tests) immediately after introducing schema or code changes.
  - Run the full lint/type/test suite before opening a PR for that bead.
- **PR cadence**:
  - Open a PR as soon as a bead’s deliverables are implemented and validated. Do not stack multiple beads on one PR.
  - PR description must reference completed bead IDs and summarize validation (tests, scripts) that were run.
  - Complete the documentation sweep (update affected docs, verify docstring coverage, ensure PR description template compliance) **before** opening or refreshing the PR to keep Docs CI green.
  - Run the docs check (`node .github/scripts/docs-check.mjs`) and resolve any failures—including docstring coverage gaps—*before* pushing or requesting review; never rely on reviewers to flag doc regressions.
  - If CodeRabbit or CI leaves actionable comments (docs template, docstrings, etc.), address them immediately rather than waiting for reviewer follow-up.
- After a PR merges, reset to `main`, re-run `bd ready` to pick the next bead, and repeat the cycle.
- If a bead reveals new follow-up work, capture it via new beads before moving on.

### Status Updates & Hand-off Protocol
- Whenever you pause or finish work, the final message to the user must explicitly state:
  1. The current status of the active bead (e.g., in progress, ready for validation).
  2. Whether the requested work is fully complete.
  3. Whether the branch is ready for a PR (or what remains before it is).
- Run and report relevant checks (lint, typecheck, tests, docs) as you implement changes—do not wait for the user to request them.
- If work is ongoing, note the next concrete step so the user can decide whether to continue or pause.

### Bead Record Structure (Title, Description, Design, Notes)
- **Title**: short action statement (verb + object) that makes the scope obvious (e.g., "Implement PRD core migrations").
- **Description**: high-level intent and business value; include success definition in plain language.
- **Design**: detailed implementation outline—key steps, affected modules, constraints, data flows, and testing expectations. Treat this as the acceptance criteria the implementer must satisfy.
- **Notes / Context**: capture decisions, links, and references (docs, PRD sections, related beads). Record clarifications or assumptions agreed with the user here.
- A bead is only "ready" when all four fields provide enough context that any agent, unfamiliar with prior work, can execute without further discovery.

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

## Planning & Task Documentation Workflow
**Development planning follows a priority-based organization in `/docs/planning/`.**

### Directory Structure (Updated October 2025)
```
/docs/
├── vision/          # Long-term product vision and strategy
├── current/         # How the system works today (maintained post-launch)
│   ├── features/    # Living documentation of shipped features
│   ├── architecture/# Technical architecture and system design
│   ├── operations/  # Operational procedures and runbooks
│   └── development/ # Development processes and guides
├── planning/        # Active development planning
│   ├── next/        # 1-3 immediate priorities ready to build
│   ├── backlog/     # Future considerations not yet prioritized
│   └── implementation/ # Active coding session logs and progress
└── archive/         # Completed work and historical documentation
```

### Workflow
1. **Planning Phase**: Create docs in `/docs/planning/backlog/` or `/docs/planning/next/`
   - Use `feat-` prefix for user-facing features
   - Use `tech-` prefix for technical/infrastructure work
   - Product requirements and technical designs
   - Move from backlog to next when ready to build (limit next to 1-3 items)

2. **Implementation Phase**: Log progress in `/docs/planning/implementation/`
   - Create session logs when starting work
   - Update with progress, decisions, and blockers
   - Reference PR numbers when created
   - Can have multiple session files for complex features

3. **Completion Phase**: Archive to `/docs/archive/` when done
   - Move planning docs and implementation logs
   - Update `/docs/current/` with living documentation
   - Keep as historical record of decisions made

### Relationship Between Directories
- **`/docs/planning/`** - Active work and future plans (temporary)
- **`/docs/current/`** - Living documentation (maintained indefinitely)
- **`/docs/archive/`** - Historical record (preserved for reference)
- **`/docs/vision/`** - North star direction (rarely changed)

**Key distinction**: Planning docs are temporary work artifacts; current docs are permanent references.

### Best Practices
- Keep `/docs/planning/next/` limited to 1-3 items you're actually ready to build
- Use clear prefixes: `feat-` for features, `tech-` for technical work
- Archive completed work promptly to avoid confusion
- Update living documentation in `/docs/current/` when shipping features
- Link planning docs to PRs and implementation logs for traceability

### Legacy Note
The `/specs/` directory contains older planning documents following a lifecycle-based structure (scoping → in-progress → completed). New work should use the `/docs/planning/` structure described above.

## WorkTree Protocol: Multi-Agent Parallel Development

### Quick Start (Per Bead)

**1. Get your assignment**
- You are assigned a bead ID (e.g., `ifs-chat-app-6`).
- Read the bead title: `bd show ifs-chat-app-6 | grep title`.
- Slugify the title: "Refactor agent tools" → `agent-tools-refactor`.

**2. Create your worktree (one-time)**
```bash
# Extract number from bead ID
BEAD_NUM=6  # from ifs-chat-app-6

# Create worktree rooted at ../ifs-bead-<number>
git worktree add ../ifs-bead-$BEAD_NUM -b feature/$BEAD_NUM-agent-tools-refactor origin/main
cd ../ifs-bead-$BEAD_NUM

# Verify branch naming
git branch --show-current  # Expect: feature/6-agent-tools-refactor
```

**3. Lock files before editing**
```bash
bead checkout ifs-chat-app-6 lib/data/therapy-tools.ts
# ✅ Locked lib/data/therapy-tools.ts for ifs-chat-app-6
# OR
# ❌ File lib/data/therapy-tools.ts is locked by ifs-chat-app-7
```

**4. Work normally**
- Edit files, run tests, commit code.
- Pre-commit hook prevents staging `.beads/*`, committing locked files, or committing on the wrong branch.

**5. Release when done**
```bash
bead release ifs-chat-app-6 lib/data/therapy-tools.ts   # release a single file
bead release ifs-chat-app-6 --all                      # release everything when finished
```

**6. Open PR and clean up**
```bash
gh pr create -B main -H feature/6-agent-tools-refactor
git worktree remove ../ifs-bead-6   # after the PR merges
```

### Bead Wrapper Commands

| Command | What it does | Example |
|---------|--------------|---------|
| `bead checkout <id> <file>` | Lock a file | `bead checkout ifs-chat-app-6 lib/widget.ts` |
| `bead release <id> <file>`  | Unlock one file | `bead release ifs-chat-app-6 lib/widget.ts` |
| `bead release <id> --all`   | Unlock everything for a bead | `bead release ifs-chat-app-6 --all` |
| `bead locks`                | Show all locks | `bead locks` |
| `bead who <file>`           | See who holds a file | `bead who lib/widget.ts` |

### Two Lanes

- **Code lane**: Your per-bead worktree (e.g., `../ifs-bead-6/`, branch `feature/6-agent-tools-refactor`). Only code changes live here.
- **Ledger lane**: Shared worktree (`../ifs-ledger/`, branch `beads-ledger`) that tracks `.beads/issues.jsonl` locks. Commit only ledger updates in this lane.

### When You Hit a Locked File

```
$ bead checkout ifs-chat-app-6 lib/data.ts
❌ File 'lib/data.ts' is locked by ifs-chat-app-7
```

Options:
1. Wait for the other agent to release the file.
2. Work on a different file: `bead checkout ifs-chat-app-6 lib/other.ts`.
3. Coordinate directly and confirm whether the other agent can release the lock.

### Branch Naming Rules

- Branches **must** follow `feature/<number>-<description>`.
- Examples: ✅ `feature/6-agent-tools-refactor`, ✅ `feature/7-data-migration`.
- The pre-commit hook blocks invalid names (missing number/description, wrong prefix, etc.).

### Checklist Before Opening a PR

- Working in the correct worktree (`../ifs-bead-N/`) on `feature/N-description`.
- All locks released (`bead locks` shows none).
- Staging only code changes (no `.beads/*` or `.beads/*.db`).
- Pre-commit hook passes without warnings.

### Troubleshooting

- **Wrong worktree?** Check `pwd` and `git branch --show-current`.
- **Missing worktree?** Recreate: `git worktree add ../ifs-bead-6 -b feature/6-description origin/main`.
- **Ledger worktree missing?** One-time setup: `git worktree add ../ifs-ledger -b beads-ledger`.
- **Pre-commit blocked commit?** Inspect `git diff --cached`, check `bead locks`, and resolve the reported issue.
- **What am I locking?** `bead locks` (all locks) or `bead who <file>` (specific file).

### Why Follow This Protocol?

- Ensures multiple agents work safely in parallel.
- Prevents accidental ledger overwrites or branch collisions.
- Provides a repeatable, self-enforcing workflow for every bead.

## Human · Droid Assistant · Codex Workflow
- **Human**: sets priority, clarifies requirements, reviews the final output, and signs off on bead completion. Reference `plan.md` or the relevant bead entry for context before giving new work.
- **Droid Assistant (Chat)**: owns planning, updates the bead record, orchestrates Codex, reviews diffs, and reports status. Do not write code directly; leverage Codex for implementation.
- **Codex CLI**: acts as the execution agent. Follow the prompts supplied by the Droid Assistant, run tests, and surface diffs. Keep Codex aligned with the conventions in this file.

### Execution Pattern (single Codex session per bead)
1. Understand the bead scope (`bd show <id>`), capture/refresh todos, and note assumptions in bead notes if needed.
2. Derive a concise implementation plan; store it in the bead (via `bd edit`) or a planning doc under `docs/planning/implementation/` when non-trivial.
3. Before launching Codex, assemble the prompt with (a) the bead summary/acceptance criteria from `bd show <id>` and (b) the initial file/function shortlist you expect Codex to touch. This keeps Codex aligned with the bead definition of done while narrowing its search surface.
4. Launch **one** Codex interactive session for the bead (`tmux new -As codex-orch` → `codex "<prompt>"`). Reuse the same session throughout; only spin additional sessions if the bead is explicitly split later.
5. Let Codex propose diffs and test runs. Review every diff before applying, ensure tests and type checks align with Acceptance Criteria, and re-run locally when Codex skips a check.
6. Record the Codex session ID (see the TUI header or `~/.codex/sessions/`) in your status update and bead notes so future agents can resume (`codex resume <SESSION_ID>`).
7. After applying changes, run mandatory local checks (lint, typecheck, unit tests, docs when required), summarize outcomes, and update the bead status.
8. Once the bead is ready to ship, prepare commits (spec → implementation if specs/docs were added), ensure docs workflow requirements are satisfied, and coordinate PR creation per Branch Management guidelines.

### Codex CLI Orchestration Tips
- Default to a single tmux window/pane for the bead. Use additional panes only for log tailing or long-running scripts—not for parallel Codex work.
- Prefer interactive mode (`codex "<prompt>"`) so Codex can iterate. Use `codex exec` sparingly for deterministic, single-command automation (e.g., “explain file”).
- Before handing off, leave Codex mid-session with a clear summary of remaining steps and copy the session ID into the status update.
