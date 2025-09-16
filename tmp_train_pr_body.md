## Summary
Merge train codex-all-open: rebasing and integrating all open, non-draft PRs into a single branch for one CI run and merge.

## Agent Context (Rich History)
### Why This Feature/Fix
Reduce integration risk and accelerate landing by validating open PRs together and merging once CI is green.

### Technical Decisions & Rationale
- Rebased each PR onto the train to maintain a linear history.
- Local validation per PR: install, lint, typecheck, unit/integration/UI tests, build. Playwright e2e intentionally skipped locally; CI will run it.
- Lockfile conflicts resolved by regenerating lockfile on the train when necessary (npm install) to minimize diffs.
- PRs that failed local rebase/validation were labeled train-failed-local and excluded; they’ll be retried in the next train.

### Problems Encountered & Solutions
- Conflicts in parts modules and session routes; excluded offending PRs to keep the train moving.

### Code Architecture
No new architecture; aggregates existing PRs linearly.

### Future Considerations
- Automate bisection for CI failures.
- Consider smaller themed trains to reduce conflict rate.

### Related Work
- Included/attempted PRs are listed below (see labels for status):
- PR 201: Refactor part schemas into shared module by @brandongalang (https://github.com/brandongalang/IFS-chat-app/pull/201)
- PR 202: Use JWT-scoped Supabase clients for chat sessions by @brandongalang (https://github.com/brandongalang/IFS-chat-app/pull/202)
- PR 203: Consolidated: merge all open codex PRs by @brandongalang (https://github.com/brandongalang/IFS-chat-app/pull/203)
