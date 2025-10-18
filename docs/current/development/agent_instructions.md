# Agent Instructions: How to Keep Docs Up To Date

When a PR merges (or before merging):
1) Identify feature areas touched by reading the diff.
2) For each feature, update a single page in docs/features/<feature>.md:
   - Update frontmatter: last_updated, status (shipped | behind-flag | experimental), related_prs, code_paths, feature_flag.
   - Update What/Why/How sections; list routes/components/endpoints and data model changes.
   - Note configuration (env vars, flags) and testing (unit/E2E).
3) If the area is new, copy docs/templates/feature.md and fill it in.
4) If migrations or flags are involved, document rollout steps and defaults.
5) Commit using Conventional Commits (docs(feature): ...), open a PR from a feature branch, and ensure checks pass locally (lint, type-check, tests).

House rules (summary)
- Require passing status checks before merge; keep main green.
- Always use a feature branch named type/scope-short-desc; squash merge; enable auto-merge once green.
- Keep PRs small; title uses Conventional Commits; description includes Why, What changed, How tested; link issues.
- Never include secrets; reference env var names only.
- For UI, add/update Playwright tests.
- Verify repo and remotes before pushing.

Feature doc frontmatter (example)
```
---
title: Feature: Parts Garden
owner: @brandongalang
status: shipped
last_updated: 2025-08-31
feature_flag: ENABLE_GARDEN
code_paths:
  - app/garden/page.tsx
  - app/garden/[partId]/page.tsx
  - components/garden/EditPartDetails.tsx
  - components/garden/PartSidebarActions.tsx
  - mastra/tools/part-tools.ts
related_prs:
  - #41
---
```

Template usage
- Copy docs/templates/feature.md → docs/features/<feature>.md
- Fill all sections; keep concise but complete; link to code and PRs.

Doc map and CI
- CI reads docs/.docmap.json to map code paths → expected docs pages.
- If a PR touches mapped code without the mapped docs file(s), CI fails (unless PR has label docs:skip with justification).

Libraries and correctness
- When touching external libraries, resolve the correct, current docs via your tooling and verify API usage; link upstream docs in the feature page.
