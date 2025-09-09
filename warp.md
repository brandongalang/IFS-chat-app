AGENTS.md — Development Operating Rules

Purpose
- Give you a simple, safe, repeatable workflow for AI-assisted development.
- Start every conversation in SAFE mode. Only enter DEV mode when explicitly asked.
- Keep continuity with a tiny active memory and an archive for the rest.

Communication style
- Write in plain English, short clear sentences.
- Speak like a senior engineer to a PM or junior engineer.
- State assumptions up front. State conclusions clearly.
- When delivering final outputs, offer next steps with P0 (must do), P1 (important), P2 (optional) and explain why.

Mental model
- Branch = a thread of work. Multiple branches can be active.
- Session = one work period on a branch (today’s work). Sessions write notes for continuity.
- Active files (always small) are read for context. Archives are searchable on demand.

Operating modes
- SAFE mode (default): planning, analysis, docs. No git. No commits. No branches.
- DEV mode (explicit): tracked code changes on a branch with commits and PRs.

Core files and structure
- MD-ACTIVE/MD-SESSION-PROTOCOL.md — working style, security policy, safeguards.
- MD-ACTIVE/ACTIVE-THREADS.md — one line per active branch: branch | status | last date | one-line summary | PR link.
- MD-ACTIVE/CHANGELOG-CURRENT.md — last 5–10 user-facing changes.
- MD-ARCHIVE/bookmarks/ — per-session notes (Completed, In Progress, Blocked, Next).
- MD-ARCHIVE/reference/ — Technical Mastery, build guides, full changelog.

Security rules (absolute)
- Never open, read, or print .env* or secret values. Reference variable NAMES only.
- Exclude .env* from searches, diffs, logs, and commands.
- Ensure .gitignore includes: .env*, .env.local, .env.honeypot, *.pem, .ssh/
- Do not paste tokens, API keys, or secrets into chat, logs, PRs, or commit messages.

Repository safety checks (before any git)
- Confirm current directory is the expected repository root.
- Confirm git remote origin matches the expected URL.
- Confirm or switch to the intended branch.
- Never proceed if repo/remote is wrong—stop and ask.

Paths policy (scope control)
- TRACKED_PATHS (example): src/, app/, components/, lib/, server/, api/
- EXCLUDE_PATHS (example): docs/, notes/, playground/, scripts/one-off/, tmp/, node_modules/, dist/
- Only stage/commit files in TRACKED_PATHS. Never commit from EXCLUDE_PATHS without explicit approval.

Branching policy
- Name branches type/scope-short-desc: feat/user-profiles, fix/navbar-z-index, chore/deps-bump, refactor/auth-session.
- One branch per work stream. Multiple active branches are fine.
- Prefer small branches and small PRs (~≤300 LOC). Split large changes.

Commit and PR policy
- Planning-only work: do not create branches, commits, or PRs. Stay in SAFE mode.
- DEV mode commit cadence:
  - Commit small, focused checkpoints as work stabilizes.
  - Run lint, type-checks, and tests before each commit. If tools are unavailable, print exact commands and wait for confirmation.
  - Use Conventional Commits: feat:, fix:, docs:, chore:, refactor:, test:, perf:, ci:
- PR policy:
  - Open a PR once a minimal slice is working and checks pass (Draft PR is fine early).
  - Title follows Conventional Commits. Description includes Why, What changed, How tested (screenshots for UI), links to issues.
  - Documentation: update /docs to reflect any user- or developer-facing changes introduced by the PR. If no doc change is needed, include 'docs:skip' with a brief justification in the PR description.
  - Do not push to main directly. Require passing checks. Keep main green.
  - Squash-merge by default. Delete branch after merge. Enable auto-merge when checks pass.
  - If revert is needed, revert the merge commit, then follow up with a fix PR.

Tool usage
- Front-end changes: use Playwright MCP where applicable.
- Library-specific work: use context7 MCP to pull current APIs and examples.
- If tools aren’t available, output exact shell commands for lint, type-checks, tests, Playwright, and git steps; proceed only after confirmation.

Session notes and continuity
- Each DEV session writes a note to MD-ARCHIVE/bookmarks/:
  - Completed, In Progress, Blocked
  - Current platform status (version, branch)
  - Next 3 priorities for this branch
  - Gotchas, decisions, and links (PRs, issues)
- Update ACTIVE-THREADS.md on /dev-start, /dev-end, and /branch-close.
  - Status values: in-progress, paused, review, blocked.

Behavioral defaults
- Start with /context to orient. SAFE mode by default.
- Enter DEV mode only via /dev-start (new or resume).
- At each meaningful checkpoint in DEV mode: run checks; if passing, commit with a Conventional Commit message.
- At /dev-end: write the session note; ask to open/update PR.
- On ambiguity (branch choice, repo mismatch, failing tests, excluded paths changed): stop and ask a concise question before proceeding.

Release hygiene
- Tag notable releases on main and update CHANGELOG via PR.
- Never include secrets in PRs, commits, or logs.

Assumptions and conclusions
- Assume slash commands are copy-paste prompts, not functions. Follow them literally.
- Conclude each coding deliverable with a brief summary and P0/P1/P2 next steps.

Conventional commit examples
- feat(user-profiles): add avatar upload with S3 presigned URLs
- fix(navbar): correct mobile z-index stacking context
- refactor(auth): extract session validator into shared util
- chore(ci): enable Playwright on PRs
- docs(api): clarify rate limits for POST /payments


Project-specific rules — Ethereal UI and theming (IFS)

# Project rules: Ethereal theme and UI consistency

These conventions ensure the ethereal visual style remains consistent and easy to tweak.

1) Use theme variables, not ad‑hoc values
- All background, vignette levels, colors/opacity, letter spacing, font weight/family, and animation timings must come from CSS variables set by the ThemeController (config/etherealTheme.ts).
- Do not hardcode hex colors, pixel values, or durations in components unless explicitly approved.

2) Tailwind + CSS variables
- When a Tailwind utility needs a variable, prefer dynamic utilities or style with var(--token).
  - Example: className="text-[color:var(--eth-text-color,theme(colors.white))]" or style={{ letterSpacing: 'var(--eth-letter-spacing-assistant)' }}
- If a Tailwind token is missing, extend Tailwind theme to reference CSS variables (not literals).

3) Background ownership
- The global background is owned by components/ethereal/GlobalBackdrop + ThemeController. Do not implement per-page backgrounds.
- Variants must be added as variables/toggles and consumed by GlobalBackdrop.

4) Typography
- Page fonts are provided via next/font and referenced by ThemeController’s fontFamilyVar. Avoid per-component font-family overrides.
- If thinner weight is required, choose a family that supports wght 100 (e.g., Inter) and set via tokens rather than inline.

5) Motion and streaming
- Streaming text must read durations from --eth-word-duration and --eth-char-duration (via a hook or computed style).
- Background animation should respect prefers-reduced-motion by default. Temporary overrides must be dev-only and documented.

6) PR checklist for UI changes
- [ ] New/changed visuals read from theme variables (no ad-hoc literals).
- [ ] GlobalBackdrop remains the sole owner of page background.
- [ ] Streaming timing bound to CSS variables, not constants.
- [ ] Feature flags used when introducing global theme changes (NEXT_PUBLIC_IFS_ETHEREAL_THEME).
- [ ] Reduced-motion behavior verified; screenshots attached for mobile/desktop.

7) Organization
- Theme config: config/etherealTheme.ts
- Theme controller: components/ethereal/ThemeController.tsx
- All ethereal components: components/ethereal/*

8) Runtime overrides (dev only)
- Local testing can override tokens via localStorage (key: eth-theme). Do not commit overrides or bake them into components.

9) Route alignment
- Apply variables first when adjusting a route (Today, Chat, Onboarding). Avoid structural refactors in the same PR.

10) Accessibility
- Maintain contrast with variables (text opacity, vignette). Do not patch individual components unless necessary.
