# Post-merge Code Health and Consistency Audit

Generated: 2025-08-30T23:30:56Z
Branch: chore/code-health-sweep
Repo: https://github.com/brandongalang/IFS-chat-app.git

Scope
- Verify recent PRs didn’t introduce build/typing/lint issues
- Identify config drift and broken scripts
- Surface DB migration ordering risks
- Propose small, focused PRs to bring the project back to green and harden CI

Environment
- Local Node: v23.10.0 (CI uses Node 20)
- Framework: Next.js 15.1.7, React 19.1.1, TypeScript 5.8.3
- Lint: ESLint 9.x (flat config in eslint.config.js)

Summary of findings
- TypeScript: 28 errors across 7 files
  - app/garden/page.tsx: onNodeClick type mismatch (react-force-graph-2d expects (node, event))
  - mastra/agents/insight-generator.ts: implicit any; mastra.createAgent not found on Mastra type
  - mastra/index.ts: implicit any
  - mastra/tools/insight-research-tools.ts: Postgrest order option uses `nulls: 'last'` which isn’t a valid key in current typings
  - mastra/tools/part-tools.ts: PartInsert/PartUpdate structural mismatches (e.g., visualization.energyLevel missing)
  - mastra/workflows/generate-insight-workflow.ts: multiple signature/typing issues with Step/execute and tool context shapes (missing limit/lookbackDays, input typing)

- Lint: warnings and at least 1 error
  - components/garden/PartSidebarActions.tsx (formerly PartActions.tsx): react-hooks/rules-of-hooks (useToast called at top level)
  - multiple @typescript-eslint/no-explicit-any and no-unused-vars warnings across API routes and components

- Build: failing with webpack module-not-found
  - Missing Node builtins in browser bundle via @mastra/core:
    - 'stream/web' and 'fs/promises' imported by @mastra/core dist chunks
    - Import trace reaches mastra/tools/part-tools.ts and app/garden/page.tsx
  - Likely cause: server-only utilities leaking into client bundle; needs server-only boundaries/dynamic imports or API indirection

- Scripts audit
  - package.json references missing files:
    - smoke:evidence → scripts/smoke-evidence.ts (missing)
    - smoke:relationships → scripts/smoke-relationships.ts (missing)
  - Present: scripts/smoke-test-insights.ts

- Config drift
  - next.config.mjs: typescript.ignoreBuildErrors=true and eslint.ignoreDuringBuilds=true (commented as temporary)
  - tsconfig.node.json includes vite.config.ts, but there’s no Vite config in repo

- Supabase migrations ordering risk
  - Duplicate migration numbers exist:
    - 007_check_ins.sql and 007_handle_new_users.sql
    - 008_add_charge_to_parts.sql and 008_message_feedback.sql
  - This can break bootstrap on fresh environments where lexicographic order matters

- Cron/API auth
  - app/api/cron/memory-update/route.ts and app/api/cron/generate-insights/route.ts both expect Authorization: Bearer ${CRON_SECRET}

- Dependencies security/outdated
  - npm audit: 1 critical (Next.js), 3 moderate (react-syntax-highlighter → refractor → prismjs)
  - npm outdated: Next latest 15.5.2 (fixes advisories), several @mastra packages slightly behind
  - depcheck marked some “unused” (likely false-positives for build-time tools): autoprefixer, eslint, eslint-config-next; verify before removal

Details

1) Typecheck output (condensed)
- app/garden/page.tsx
  - onNodeClick handler type mismatch: expected (node, event) signature from react-force-graph-2d NodeObject
- mastra/agents/insight-generator.ts
  - implicit any; Mastra API surface mismatch (createAgent missing on typed Mastra instance)
- mastra/tools/insight-research-tools.ts
  - order('last_active', { ascending: false, nulls: 'last' }): `nulls` key not in current Postgrest options type
- mastra/tools/part-tools.ts
  - PartInsert/Update not assignable to Partial<PartRow>: visualization.energyLevel required by lib/types/database.ts
- mastra/workflows/generate-insight-workflow.ts
  - Step definitions missing input/output schemas; execute signature mismatch; tool context invocations missing required fields (limit, lookbackDays)

2) Lint (condensed)
- React hooks rule violation: components/garden/PartSidebarActions.tsx (formerly PartActions.tsx) uses useToast outside component/hook
- Various @typescript-eslint warnings: any/no-unused-vars in cron and insights routes

3) Build failures (webpack)
- Module not found 'stream/web', 'fs/promises' via @mastra/core
- Likely fix options:
  - Ensure @mastra/core usage is server-only: move calls into route handlers/server components, or dynamic import on server
  - Use next/dynamic with ssr: false cautiously only for client-only components (but Node builtins won’t be available client-side regardless)
  - Consider serverExternalPackages or bundle strategy for Pages vs. App Router; validate import paths in app/garden/page.tsx

4) Scripts audit
- Missing: scripts/smoke-evidence.ts, scripts/smoke-relationships.ts
- Present: scripts/smoke-test-insights.ts
- Proposal: remove broken scripts and add "smoke:insights": "tsx scripts/smoke-test-insights.ts"

5) Config drift
- next.config.mjs ignores TS/ESLint errors (temporary): OK until codebase clean, but prefer re-enabling post-fix
- tsconfig.node.json references Vite config that doesn’t exist: remove stale include

6) Migrations
- Duplicate numbering (007, 008) introduces ordering ambiguity for new environments
- If not yet applied in any shared DB: rename to next free numbers (009, 010)
- If applied: do not rename; add corrective migrations and a MIGRATIONS.md explaining history and bootstrap order

7) Cron/API auth
- Cron routes standardized on Authorization: Bearer ${CRON_SECRET} (documented in README and workflow)

8) Dependencies and security
- Upgrade Next.js to >= 15.5.2 to address critical/high advisories
- Investigate react-syntax-highlighter → refractor/prism vulnerabilities; consider upgrade path or alternative
- @mastra packages have minor updates available
- depcheck/ts-prune:
  - depcheck lists several “unused” that are likely used by tooling: verify before removal (e.g., autoprefixer, eslint)
  - ts-prune output did not flag obvious unused exports beyond internal notes; re-run after type fixes to reduce noise

Proposed small PRs (<~300 LOC each)
- PR A: chore/scripts
  - Remove smoke:evidence and smoke:relationships
  - Add smoke:insights mapping to scripts/smoke-test-insights.ts
  - Optional: add a scripts:verify node script to check script file existence
- PR B: chore/tsconfig-node
  - Remove Vite reference from tsconfig.node.json
- PR C: chore/migrations
  - Resolve duplicate numbering if safe; or add corrective migration + MIGRATIONS.md
- PR D: chore/ci-security
  - Add Gitleaks secrets scan job; keep concurrency; ensure checks required
- PR E: chore/dx
  - Add .nvmrc (20), .editorconfig, Prettier config + scripts
- PR F: chore/next-config
  - Re-enable Next build TS/ESLint checks after type/lint fixes are green
- PR G: fix/types-and-build (may split further)
  - Address type errors in garden page, mastra agent/tools/workflow typings
  - Ensure @mastra/core is server-only to fix webpack build

Immediate priorities
1) Fix build break (server-only use of @mastra/core) and garden onNodeClick typing
2) Repair broken scripts in package.json
3) Resolve migration numbering ambiguity for clean bootstrap
4) Upgrade Next.js to >= 15.5.2 to address advisories (coordinate with build fixes)

Notes
- Local Node is 23.x but CI uses 20.x. Add .nvmrc=20 to align dev with CI
- Keep main green; use small PRs and enable auto-merge once checks pass
- Never commit secrets; .env.local remains gitignored
