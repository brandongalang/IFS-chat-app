# PRD Cutover & Legacy Schema Decommission – Implementation Log

**Date**: 2025-10-17  
**Bead**: ifs-chat-app-9  
**Status**: In progress  
**Branch**: feature/ifs-chat-app-9-legacy-schema-cutover  
**Codex Session**: _TBD_  

## Objectives
- Confirm no production surfaces still rely on the legacy `parts`/`part_relationships` tables.
- Shift client data access (`parts-lite`, Garden UI) onto PRD-backed helpers.
- Remove markdown write tooling from the IFS agent stack while preserving read-only snapshot hydration.
- Capture rollback steps and documentation deltas ahead of PR handoff.

## Task List
- [x] Inventory live imports for `lib/data/parts.ts`, `lib/data/parts-lite.ts`, and markdown write tools.
- [x] Update client-facing parts queries to use `parts_v2` / PRD mappers.
- [x] Retire markdown write tooling (`mastra/tools/markdown-write-tools.ts`, `memory-markdown-tools` writes) and adjust agent wiring.
- [x] Refresh docs (agent tools, user memory runbooks, parts garden) and record rollback guidance.
- [x] Run lint, targeted unit tests, and docs check prior to PR.

## Notes
- Dependencies (ifs-chat-app-6/7/8) shipped PRD schema, backfill, and observability; this cutover finalizes the read/write path.
- Keep snapshot readers (overview/part profile) temporarily to avoid breaking in-flight session logs; deprecate once PRD timeline replaces markdown context.
- Rollback plan must describe toggling `IFS_ENABLE_MARKDOWN_CONTEXT` and redeploying `parts-lite` to legacy tables if critical regressions appear.
- Update summations now insert Supabase `observations` rows (type `note`) via service-role admin client; verify dashboards consume the new stream before removing the legacy markdown change log.

## Validation
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `node .github/scripts/docs-check.mjs` (with `BASE_SHA`/`HEAD_SHA`)
