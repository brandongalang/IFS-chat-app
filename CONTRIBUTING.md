# Contributing

Thank you for contributing to IFS Therapy Companion.

Workflow
- Always work on a feature branch named type/scope-short-desc (e.g., feat/chat-back-button, fix/session-end).
- Do not push directly to main. Open a PR and merge when checks pass.
- Prefer small PRs (< ~300 LOC diff). Split large work if needed.
- Use squash merge into main by default; delete the branch after merging.
- Keep main always green.

Commits and PRs
- Conventional Commits for commit messages (feat:, fix:, docs:, chore:, etc.).
- PR title should follow Conventional Commits.
- PR description must include: Why, What changed, How tested (with screenshots if UI), and link related issues.

Pre-flight before PR
- Install and validate locally:
  - npm ci
  - npm run typecheck (or npx tsc --noEmit)
  - npm run lint
  - npm run build
- For front-end changes, add or run Playwright tests as applicable.

CI and protections
- PRs must pass CI status checks before merge (secrets scan, typecheck, lint, build).
- Rebase or enable auto-merge to keep history linear.

Secrets and environment
- Never include secrets in PRs, commit messages, or logs.
- Copy .env.example to .env.local and fill in values locally.
- .env files are gitignored by default; do not commit them.

Reverts
- If a revert is needed, revert the merge commit and follow up with a fix PR.
