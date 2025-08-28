# Tasks

## Lint cleanup (remaining warnings)

- [x] components/common/GuardedLink.tsx
  - [x] Replace `any` types at lines ~16 and ~24 with explicit types (props, router/link event payloads).
- [x] components/ui/calendar.tsx
  - [x] Replace `any` at line ~61 with proper event/value types (Radix/date library types).
- [ ] components/ui/chart.tsx
  - [ ] Replace several `any` usages (~112, 118, 119, 125, 214, 215, 323). Define chart data/series types and handler payloads.
- [x] components/ui/toaster.tsx
  - [x] Replace `any` at ~17 with specific toast data type.
- [ ] lib/database/action-logger.ts
  - [ ] Replace `any` types (~30, 39, 40, 66, 100, 287, 288, 313, 406, 410) with explicit interfaces for log payloads and DB rows.
  - [ ] Remove or use unused variables: `_metadata`, `_limit`, `_actionTypes`, `_sessionId`, `_withinMinutes`, `_actionId`.
- [ ] lib/database/validate.ts
  - [ ] Remove unused `Database` import (~5) and other unused variables (`data`, `userId2`).
  - [ ] Replace `any` (~10, 109) with explicit types; ensure helper function signatures are typed.
- [ ] lib/toolDetection.ts
  - [ ] Replace `any` in JSON formatting helpers (~125, 126) with concrete types or generics.
- [ ] lib/types/database.ts
  - [ ] Replace `any` in generated/utility types (~527, 533). If generated, consider eslint override on generated sections.

Notes:
- Prefer narrow domain types over generic records.
- If files are generated or vendor code, consider targeted eslint disable blocks with justification.

## Repository automation

- [ ] Enable GitHub auto-merge for main PRs (squash) when checks pass
  - [ ] Configure branch protection rules on `main` to allow auto-merge, require status checks (lint, typecheck, CI) and linear history.
  - [ ] Optionally enable “auto-merge when ready” in the repository settings so `gh pr merge --auto --squash` is permitted.

