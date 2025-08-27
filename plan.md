# IFS Therapy Companion — Current State and Cleanup Plan

Last updated: 2025-08-27

## Executive summary
- The app builds and runs locally. Type checking (tsc) is currently green.
- CI is intentionally disabled (workflows short-circuited) to unblock merging. Next.js build is configured to ignore TS errors during build (temporary).
- ESLint is currently broken due to a missing dependency (typescript-eslint), so `npm run lint` fails.
- Several side branches exist from AI-assisted coding; we will consolidate and clean them up.

---

## Repository state
- Default branch: main
- Active local branches:
  - backup/pre-filter-repo-20250827-155646 — snapshot/backup branch
  - chore/ci-and-secrets-hygiene — config hygiene work
  - feat/chat-branding — UI/content tweaks
  - feat/wire-chat-to-agent — chat→agent wiring work
  - fix/ts-ci-green — TypeScript fixes and CI temporary relaxation (merged into main)
  - main — current default branch

Recommendation: consolidate into main, archive/delete stale feature branches once their unique commits are reviewed/merged (see Branch cleanup plan below).

---

## Application state
- Framework: Next.js 15
- TypeScript: ~5.8.3
- Styling/UI: TailwindCSS, Radix UI primitives, class-variance-authority
- Data: Supabase client utilities present
- Mastra: Config + tools present; telemetry primitives included in @mastra/core

Key recent fixes
- Hooks restored/added: use-mobile, use-toast to satisfy UI imports
- Mastra config: corrected import to use `Config` from @mastra/core
- Supabase usage: added missing `await` where calls previously referenced the Promise
- UI typing: hardened chart/calendar and toaster typings

---

## CI/CD state (current)
- GitHub Actions workflow: .github/workflows/ci.yml
  - Temporarily disabled: both jobs (secrets-scan, build) are no-ops that echo and succeed
  - Concurrency enabled to prevent duplicate runs
- Next.js build config: next.config.cjs
  - typescript.ignoreBuildErrors: true (temporary)
  - eslint.ignoreDuringBuilds: true

Implications
- Merges to main are not validated by CI right now
- Builds won’t fail on TS errors (but note: tsc is green at time of writing)
- Lint is not executed in CI and currently fails locally due to dependency issues

---

## Type and lint status
- Typecheck: PASS
  - Command: `npm run typecheck` (tsc --noEmit)
  - Current status: 0 errors
- Lint: FAIL
  - Command: `npm run lint` (next lint)
  - Error: "Cannot find package 'typescript-eslint' imported from eslint.config.js"
  - Root cause: eslint.config.js uses the flat config `typescript-eslint` package, which is not present in devDependencies
  - Suggested fix: add `typescript-eslint` (v8+) as a devDependency to match ESLint v9

---

## Risks and gaps
- CI disabled means regressions can land unnoticed
- Lint not running can allow code quality issues to accumulate
- Branch sprawl increases merge complexity and context loss

---

## Cleanup and hardening plan

1) Re-enable robust CI (short-term, 1–2 commits)
- Add devDependency: `typescript-eslint@^8` to satisfy eslint.config.js
- Restore GitHub Actions workflow to run:
  - Install: `npm ci`
  - Typecheck: `npx tsc --noEmit`
  - Lint: `npm run lint`
  - Build: `npm run build`
- Keep concurrency/caching (Node 20 + npm cache)
- Make these jobs required in branch protection once stable

2) Re-tighten build-time type enforcement (immediate after lint fix)
- Set `typescript.ignoreBuildErrors: false` in next.config.cjs once `npm run typecheck` is consistently green in CI

3) Optional additions (mid-term)
- Secrets scan: re-enable gitleaks job
- Tests: add a basic unit/integration test job when tests exist
- Artifact upload: optionally upload Next.js build output for inspection (PRs)

4) Branch cleanup
- Review unique commits per branch before deletion:
  - Example commands:
    - `git --no-pager log --oneline --left-only backup/pre-filter-repo-20250827-155646...main`
    - `git --no-pager log --oneline --left-only feat/wire-chat-to-agent...main`
- If empty diff vs main, delete:
  - Local: `git branch -D <branch>`
  - Remote: `git push origin --delete <branch>`
- For branches with valuable commits: merge or cherry-pick into main, then delete

5) Documentation hygiene
- Keep `.env.example` current with placeholders for all required env vars
- Add a short CONTRIBUTING.md section for local setup, scripts, and CI expectations

---

## Concrete next steps (proposed sequence)
1. Add missing devDependency and re-enable CI
   - `npm i -D typescript-eslint@^8`
   - Restore ci.yml steps (install, typecheck, lint, build)
2. Re-enable build-time type checks
   - Set `ignoreBuildErrors: false` in next.config.cjs
3. Prune branches
   - Evaluate and merge/cherry-pick valuable changes; delete the rest locally and on origin
4. Make checks required on main
   - Require "Typecheck", "Lint", and "Build" jobs to pass before merge

---

## Current status snapshot
- Typecheck: green
- Lint: failing (missing typescript-eslint)
- CI: disabled (no-op jobs), to be re-enabled
- Main: contains recent TS fixes and UI hook restorations

End of plan.

