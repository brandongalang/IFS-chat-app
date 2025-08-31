# Agents: Start Here

If you are an AI agent or contributor, follow these rules to keep code and docs aligned. This file is intentionally at repo root so agents discover it first.

What to update (and when)
- Update docs whenever a PR changes behavior, routes, data models, feature flags, or migrations.
- Each feature has one canonical page in docs/features/*.md. Do not create "recent changes" sections; update the relevant feature page instead.
- Keep status accurate: shipped | behind-flag | experimental. Update last_updated.

Where to update
- docs/features/<feature>.md — canonical feature docs (use the template in docs/templates/feature.md)
- docs/current_state/ — thin index linking to features, with short human-readable summaries
- docs/agent_instructions.md — the detailed playbook (checklists) for updating docs

Process (house rules)
- Branching: Always develop on a feature branch (type/scope-short-desc). Do not push to main.
- Commits: Conventional Commits; keep commits small and focused; never include secrets.
- PRs: Require passing status checks; keep main green; prefer small PRs; title uses Conventional Commits; description includes Why, What changed, How tested (screenshots if UI), and links issues.
- Merging: Squash merge; enable auto-merge when checks pass; delete the branch after merge.
- Verification: Run lint, type-checks, and tests locally before PR. For UI, add/update Playwright tests.
- Remotes: Verify repo and origin before pushing. Never expose secrets; reference env var names only.

Codebase overview (what an agent should know)
- Framework: Next.js 15 (app/ router), React 19, Tailwind
- Data: Supabase/Postgres with RLS; migrations in supabase/migrations/
- Agents: Mastra-based agents in mastra/ (tools and prompts)
- App structure: 
  - app/ – Next.js routes (e.g., /chat, /check-in/*, /garden/*)
  - components/ – UI components (e.g., check-in forms, garden parts UI)
  - hooks/ – React hooks (e.g., useChat)
  - lib/ – server/client libs (database validators, insights generator)
  - supabase/ – SQL migrations and config
  - scripts/ – node/tsx scripts for verification and smoke tests
  - docs/ – documentation (this IA)

Documentation workflow (quick version)
1) Determine which feature(s) changed.
2) For each feature, update docs/features/<feature>.md:
   - Update frontmatter: last_updated, status, related_prs, code_paths, feature_flag.
   - Update What/Why/How, routes/components, data model, config, testing, ops notes.
3) If a brand-new feature area, copy docs/templates/feature.md and fill it in.
4) If a migration or flag exists, document rollout steps and defaults.
5) Commit using Conventional Commits (docs(feature): ...), open a PR, ensure checks pass.

Doc map and CI
- The docs-check workflow uses docs/.docmap.json to map code paths → expected docs pages.
- If a PR touches mapped code without touching the mapped docs file(s), CI will fail unless the PR has label `docs:skip` with a justification.

Using external library docs (agents)
- When modifying code that uses external libraries, resolve the correct library docs (e.g., via your tooling) and verify current APIs before editing. Prefer linking to relevant upstream docs in the feature page.

See also
- docs/agent_instructions.md — detailed playbook
- docs/templates/feature.md — template to create a new feature page

