---
title: Gate snapshot hydration on markdown flag (ifs-chat-app-12)
created: 2025-10-17
status: in_progress
bead_id: ifs-chat-app-12
related_prs: []
---

## Overview
- Stop relying on `isMemoryV2Enabled()` for snapshot hydration within the parts agent.
- Use the runtime toggle `env.ifsMarkdownContextEnabled` so markdown reads follow the same flag used by chat agents.
- Preserve server-only execution and ensure response shapes remain unchanged.

## Plan
1. Inspect `lib/data/schema/parts-agent.ts` for all markdown snapshot read paths (`readOverviewSections`, `readPartProfileSections`, `readRelationshipProfileSections`).
2. Import `env` from `@/config/env` and gate each snapshot block with `env.ifsMarkdownContextEnabled && typeof window === 'undefined'`.
3. Remove unused `isMemoryV2Enabled` dependency once reads are guarded by the flag.
4. Verify no other code paths depend on `isMemoryV2Enabled()` for these reads; leave other memory operations untouched.
5. Update docs if required (docmap points to `docs/current/features/agent-tools.md` and `docs/current/architecture/parts-systems-overview.md`) to note the flag gating for parts hydration if behavior meaningfully changed.

## Validation
- With `IFS_ENABLE_MARKDOWN_CONTEXT=false`, ensure `getPartById`, `getPartDetail`, and `getPartRelationships` no longer load markdown snapshots (by toggling env in tests or adding targeted coverage).
- Run affected unit tests: `npm run test:unit` (or a focused subset if available).
- Standard checks: `npm run lint`, `npm run typecheck`, docs check if documentation is updated.
