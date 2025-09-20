# Repository Guidelines

## Project Structure & Module Organization
The Next.js 15 app lives under `app/` with route-based directories and colocated layouts. Shared UI belongs in `components/`, reusable hooks in `hooks/`, and cross-cutting utilities in `lib/`. Configuration defaults sit in `config/`, while Supabase and Mastra workflows are under `supabase/` and `mastra/`. Global types live in `types/`. Assets go in `public/`, and supporting scripts reside in `scripts/`. Unit test helpers are in `scripts/tests/unit/`; Playwright E2E specs sit in `e2e/`.

## Build, Test, and Development Commands
Use `npm run dev` for the Next.js dev server. Produce a production bundle with `npm run build` and serve it via `npm start`. Run linting with `npm run lint`, type safety checks with `npm run typecheck`, and unit tests plus onboarding checks using `npm test`. Execute Playwright flows with `npm run test:e2e` (add `:headed` locally for debugging). Develop Mastra agents through `npm run dev:mastra` and build them with `npm run build:mastra`.

## Coding Style & Naming Conventions
All code is TypeScript with React 19 function components. Follow a 2-space indent and rely on Prettier + ESLint (Next.js config) for formatting. Use Tailwind tokens for styling. Name components `PascalCase.tsx`, hooks `useThing.ts`, and shared libraries `camelCase.ts`. Route directories under `app/` define URL segments.

## Testing Guidelines
Keep unit tests deterministic and colocated in `scripts/tests/unit/*.test.ts`. Favor descriptive test names that mirror user behavior. Run `npm test` before every push, and verify E2E flows with `npm run test:e2e` when touching routes or async flows. Add targeted tests for regressions.
- After finishing the feature or fix that was requested, run `npm run lint`, `npm run typecheck`, and `npm test` before pushing or asking for review so we hand off a fully verified branch.

## ast-grep Structural Checks
- Reach for `ast-grep` when text search falls short—use `ast-grep scan` with repository rules to enforce structural policies before opening a PR, or run ad-hoc patterns like `ast-grep -p '$A && $A()' -l ts -r '$A?.()'` for safe codemods.
- Bootstrap new rule sets with `ast-grep new` so teams can codify recurring review comments and keep a tested `rules/` + `rule-tests/` scaffold under version control.

## Commit & Pull Request Guidelines
Use Conventional Commits such as `feat(chat): add streaming endpoint` or `fix(auth): handle refresh`. Branch names should follow `type/scope-short-desc`. PRs need a clear summary, linked issues when applicable, testing notes, and UI screenshots for visual changes. Ensure lint, typecheck, unit tests, and required E2E cases are green before requesting review.

## GitHub CLI Usage
When interacting with GitHub from the command line (opening PRs, checking status, commenting), prefer the GitHub CLI (`gh`). If a teammate asks for a GitHub action, reach for `gh` commands by default.

## Security & Configuration Tips
Never commit secrets; store credentials in environment files modeled after `.env.example`. Confirm that `.env*` entries remain git-ignored. Configure Supabase keys only via env variables. Keep `AGENTS.md` local—Git ignores it by default, so share it manually when needed.
