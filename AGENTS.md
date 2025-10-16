# Agent Guidelines

We track work in Beads instead of Markdown. Run `bd quickstart` to see how.

---

## Quick Reference Card

**Starting Work**
```bash
# 1. Verify clean branch
git branch --show-current

# 2. Get next bead
bd ready

# 3. Understand requirements
bd show <id>

# 4. Create new branch if needed (if current has open/merged PR)
git checkout -b feature/<description>
```

**During Implementation**
```bash
# 1. Review every diff/change as you implement

# 2. Update bead status as you progress
bd edit <id>  # Update to implement/validate/ship

# 3. Run checks incrementally
npm run migrations:verify  # After schema changes
npm test                   # After code changes
```

**Before Final Response** ⚠️
```bash
# 1. Re-read AGENTS.md relevant sections (see Pre-Response Checklist below)

# 2. Run quality gates
npm run lint
npm run typecheck
npm test
node .github/scripts/docs-check.mjs

# 3. Update bead status
bd edit <id>

# 4. Commit .beads database
git add .beads && git commit -m "chore: update bead status"

# 5. State in response: (a) bead status, (b) work completion, (c) PR readiness
```

**Shipping**
```bash
# 1. Verify docs check passes
node .github/scripts/docs-check.mjs

# 2. Create PR with bead ID in description
gh pr create --title "Complete bead <id>: <title>" --body "..."

# 3. After merge
git checkout main
git pull
bd ready  # Get next bead
```

---

## Core Workflow (Bead Lifecycle)

Every bead progresses through **plan → implement → validate → ship** before picking up the next task.

### Phase 1: Plan

1. **Get next bead**: `bd ready` (shows highest-priority bead)
2. **Review requirements**: `bd show <id>`
3. **Branch check**: Run `git branch --show-current`
   - If current branch has open/merged PR → create new branch from `main`
   - Use format: `feature/<description>`, `fix/<description>`, `refactor/<description>`
   - Never build new work onto a branch with existing PR
4. **Create todo list**: `bd create` or `TodoWrite` tool so each subtask is traceable
5. **Document assumptions**: Use `bd edit <id>` to add notes/context to bead
6. **Derive implementation plan**: Store in bead or create doc in `docs/planning/implementation/` for non-trivial work

### Phase 2: Implement

1. **Implement directly**: Use Claude Code tools to make changes
   - Review every change as you make it
   - Ensure tests and type checks align with acceptance criteria
2. **Stage commits incrementally**: Avoid large "mega" commits spanning multiple beads
3. **Run targeted checks immediately** after changes:
   - Schema changes → `npm run migrations:verify`
   - Code changes → relevant unit tests
4. **Update bead status**: `bd edit <id>` to set status to "implement"
5. **Commit `.beads` database**: After status changes so downstream agents see current state

### Phase 3: Validate

1. **Run full test suite**:
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```
2. **Update documentation** (see Quality Gates → Documentation below)
3. **Run docs check**: `node .github/scripts/docs-check.mjs`
   - Resolve any failures including docstring coverage gaps
   - Never rely on reviewers to flag doc regressions
4. **Address CI/CodeRabbit feedback**: Immediately, don't wait for reviewer follow-up
5. **Update bead status**: `bd edit <id>` to set status to "validate"

### Phase 4: Ship

1. **Open PR**: `gh pr create`
   - Reference bead ID in description
   - List validation steps performed (tests, scripts run)
   - Use required PR template format
   - **One bead per PR** - do not stack multiple beads
2. **After merge**:
   ```bash
   git checkout main
   git pull
   bd ready  # Get next bead and repeat cycle
   ```

### Phase 5: Archive (if needed)

1. **Capture follow-up work**: If bead revealed new tasks, create new beads via `bd create`
2. **Move planning docs**: From `/docs/planning/implementation/` to `/docs/archive/`
3. **Update living docs**: Update `/docs/current/` if feature shipped

### Status Updates & Hand-off Protocol

Whenever you pause or finish work, the final message to the user must explicitly state:

1. **Current bead status**: What phase is it in? (plan/implement/validate/ship)
2. **Work completion**: Is the requested work fully done, or what remains?
3. **PR readiness**: Can this be shipped, or what's blocking?
4. **Next step**: What's the immediate next action?

Additional requirements:
- Run and report relevant checks (lint, typecheck, tests, docs) as you implement—do not wait for user to request
- If work is ongoing, note concrete next steps so user can decide whether to continue or pause

---

## Quality Gates

All PRs must pass these gates before requesting review.

### 1. Testing Requirements

**When to run:**
- **Targeted tests** → immediately after code changes
- **Full suite** → before opening PR

**Commands:**
```bash
npm run lint                   # Code style
npm run typecheck              # Type safety
npm test                       # Unit/integration tests
npm run migrations:verify      # If schema changed
```

**Standards:**
- All tests must pass
- No type errors
- No lint warnings
- New code should have test coverage

### 2. Documentation Requirements

**Always update docs when changes affect:**
- ✅ Behavior, data flow, or system design
- ✅ User-facing features or UI/UX
- ✅ API contracts, database schemas, or data models
- ✅ Configuration or environment variables
- ✅ Tool/agent capabilities or workflows

**Skip docs only when change is purely non-functional:**
- ❌ Code formatting or style fixes
- ❌ Comment-only updates
- ❌ Test refactors (no behavior change)
- ❌ Dependency version bumps without API changes
- **If skipping: add `docs:skip` label + justification in PR description**

**Update process:**

1. **Identify affected areas** using `docs/.docmap.json`:
   ```bash
   git diff main...HEAD --name-only  # See changed files
   # Match changed paths against docmap patterns
   # Update ALL mapped docs that correspond to changed code
   ```

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

5. **Add docstrings** for new public functions/classes

**Validation:**
```bash
node .github/scripts/docs-check.mjs  # Must pass before PR
```

**Documentation standards:**
- Use clear, concise language
- Include code examples where helpful
- Link to related PRs, issues, and other docs
- Keep frontmatter metadata up to date
- Follow existing doc structure and conventions

### 3. CI Compliance

- Docs check must be green
- Address CodeRabbit comments immediately (don't wait for reviewer)
- PR description must match template
- No commits titled "WIP" or "fix tests"

---

## Bead Record Structure

A bead is only "ready" when all four fields provide enough context that any agent, unfamiliar with prior work, can execute without further discovery.

**Required fields:**

- **Title**: Short action statement (verb + object) that makes scope obvious
  - Example: "Implement PRD core migrations"

- **Description**: High-level intent and business value
  - Include success definition in plain language

- **Design**: Detailed implementation outline—acceptance criteria
  - Key steps, affected modules, constraints
  - Data flows and testing expectations
  - What the implementer must satisfy to consider it complete

- **Notes / Context**: Decisions, links, and references
  - Docs, PRD sections, related beads
  - Clarifications or assumptions agreed with user

---

## Role Definitions

### Human
- Sets priority and clarifies requirements
- Reviews final output and signs off on bead completion
- Reference `plan.md` or relevant bead entry for context before giving new work

### Agent (Claude Code)
- Executes bead work using available tools (Read, Edit, Bash, etc.)
- Runs tests and validates changes
- Reports status to human with clear work completion summary
- Stays aligned with conventions in this file

---

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

**1. Planning Phase**: Create docs in `/docs/planning/backlog/` or `/docs/planning/next/`
- Use `feat-` prefix for user-facing features
- Use `tech-` prefix for technical/infrastructure work
- Product requirements and technical designs
- Move from backlog to next when ready to build (limit next to 1-3 items)

**2. Implementation Phase**: Log progress in `/docs/planning/implementation/`
- Create session logs when starting work
- Update with progress, decisions, and blockers
- Reference PR numbers when created
- Can have multiple session files for complex features

**3. Completion Phase**: Archive to `/docs/archive/` when done
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

---

## Pre-Response Checklist

**Before every final response to the user, verify:**

### ✅ Self-Review

**Re-read AGENTS.md sections relevant to current work:**
- If implementing → review **Core Workflow**
- If shipping → review **Quality Gates**
- If documenting → review **Planning & Task Documentation Workflow**

### ✅ Work Status Communication

**Must explicitly state:**
1. **Bead status**: What phase is the active bead in? (plan/implement/validate/ship)
2. **Completion**: Is the requested work fully done, or what remains?
3. **PR readiness**: Can this be shipped, or what's blocking?
4. **Next step**: What's the immediate next action?

### ✅ Quality Verification

**If claiming work is "done" or "ready for PR":**
- [ ] All Quality Gates passed (tests, docs, CI)
- [ ] Bead status updated in Beads
- [ ] `.beads` database committed
- [ ] Branch is clean and up-to-date

### ✅ Context Hand-off

**If pausing mid-work:**
- [ ] Documented current state in bead notes
- [ ] Listed concrete next steps
- [ ] Captured any blockers or open questions

**This checklist prevents:**
- Forgetting to run required checks
- Leaving work in ambiguous state
- Missing documentation updates
- Incomplete hand-offs between agents

---

## Decision Log

Historical context and architectural decisions. Reference these when encountering related code.

### Tool Architecture (2025-09-26)

- Mastra tool modules export factory helpers (e.g., `createAssessmentTools`)
- Factories require server-derived user ID
- Inject profile's user ID when wiring agents
- **Context**: Stacked PRs (#262, #263) diverged from Supabase architecture; prefer cutting fresh branches from `main`, cherry-pick essential tool/schema updates, and drop legacy dependency injection patterns

### Schema Conventions (2025-10-01)

- Part-related Zod schemas use `.strict()`
- Server injects user identity; keep `userId` out of tool payloads/tests
- **Reference**: `scripts/tests/unit/part-schemas.test.ts`

### API Consistency (2025-10-02)

- Inbox APIs expose Supabase `source_id` as both `id` and `sourceId`
- Do not reintroduce separate `id` column in `inbox_items_view`
- Client events must send `sourceId`

### Documentation Maintenance (2025-10-03)

- When multi-phase plan (e.g., session logs like `docs/10_1_session.md`) is finished, update relevant feature docs/runbooks before closing workstream
- Keeps docs CI check green

### PR Documentation Sweep (2025-10-08)

- Before opening/refreshing PR: rerun docs sweep
- Confirm `docs/features/**` lists every touched module
- Update `code_paths`, `last_updated`, etc.
- Ensure PR description matches required template so docs CI check passes on first run

### README Direct Commit (2025-10-11)

- **One-time exception**: README rewrite committed directly to `main` by user instruction; no PR opened
- **Context**: Portfolio documentation update
- **Future**: Return to standard branch/PR flow
