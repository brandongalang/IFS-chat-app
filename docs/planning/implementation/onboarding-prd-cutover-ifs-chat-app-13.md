---
title: Migrate onboarding synthesis to PRD (ifs-chat-app-13)
created: 2025-10-17
status: in_progress
bead_id: ifs-chat-app-13
related_prs: []
---

Overview
- Replace legacy markdown edits during onboarding completion with a PRD observation write.
- Keep API response shape unchanged; remove editMarkdownSection/ensureOverviewExists usage.

Design
- Build summary strings using `buildOnboardingSummary()`.
- Insert `observations` row via `recordObservation({ type: 'note', content, metadata }, { userId })`, where metadata includes the structured summary and explicit `question_answers` (prompt + formatted answer + raw response).
- Remove call to `synthesizeOnboardingMemories()` in `app/api/onboarding/complete/route.ts`.
- Treat observation failure as non-fatal (do not block completion).

Acceptance Criteria
- POST `/api/onboarding/complete` produces an observation row.
- No markdown write calls occur as part of completion.
- Route returns 200 OK with unchanged response shape.

Implementation Notes
- Changed: `app/api/onboarding/complete/route.ts` to drop markdown synthesis, add PRD observation write, and enrich `metadata.question_answers` for agent-readable context.
- Updated docs: `docs/current/features/onboarding.md` to reflect PRD write, question metadata, and no markdown edits.

Branch
- Intended branch: `feature/13-migrate-onboarding-synthesis-to-prd-remove-markdown-edits`.
- Deviation: local environment prevented git writes; branch creation deferred to PR stage.

Validation Plan
- Unit: exercise `/api/onboarding/complete` with a staged user; confirm `observations` has a new `note` row.
- Lint/type: run `npm run lint` and `npm run typecheck`.
- Docs: ensure docs sweep maps `app/api/onboarding/**` and passes CI.

Next Steps
- Create feature branch from `origin/main` and open PR with bead ID reference once git access is available.
