---
title: Feature: Onboarding Flow
owner: @brandongalang
status: shipped
last_updated: 2025-10-17
feature_flag: null
code_paths:
  - app/onboarding/page.tsx
  - components/onboarding/OnboardingWizard.tsx
  - components/onboarding/OnboardingCompletionSummary.tsx
  - app/api/onboarding/**
  - lib/onboarding/**
related_prs:
  - #234
---

## What
A staged onboarding experience that gathers core context, adapts follow-up questions, and produces a personalized completion summary before routing the user into the main app.

## Why
- Collect the minimum viable context for parts-oriented support without overwhelming the user.
- Generate a human-readable summary the assistant can reference immediately after onboarding.
- Ensure every new user has a consistent set of required responses for analytics and memory generation.

## Flow overview
1. **Stage 1 – Baseline**: Five required questions scored via `computeStage1Scores`. Once complete, the API selects Stage 2 questions tailored to the user.
2. **Stage 2 – Adaptive deep dive**: Question bank curated in Supabase; selection driven by `selectStage2Questions`. Autosave enforces optimistic concurrency via the `version` field on `user_onboarding`.
3. **Stage 3 – Integration**: Reflection prompts and somatic check-ins to balance the summary.
4. **Completion**: `/api/onboarding/complete` validates required responses, marks the state `completed`, triggers `buildOnboardingSummary`, emits an `onboarding_completed` analytics event, records a PRD observation row (type `note`, `metadata.source='onboarding'`) that includes full question/answer metadata, and returns a redirect payload plus summary data for the client.

## Key components
- `OnboardingWizard`: handles autosave, stage progression, optimistic versioning, and local analytics events.
- `OnboardingCompletionSummary`: renders top insights (parts, themes, somatic notes) along with next-step CTA.
- `config/onboarding-questions.json`: declaratively stores question copy, ordering, and completion requirements.

## APIs & Services
- `POST /api/onboarding/progress`: Upserts responses, recomputes scores, selects Stage 2 questions, and returns updated state (see `app/api/onboarding/progress/route.ts`).
- `POST /api/onboarding/complete`: Validates all required answers, builds a summary, persists a PRD observation (type `note`, source `onboarding`) with `metadata.summary` and `metadata.question_answers`, and returns completion metadata (see `app/api/onboarding/complete/route.ts`).
- `lib/onboarding/summary.ts`: Consolidates responses into `CompletionSummary` (parts, themes, somatic insights, suggested statements).

## Data model
- `user_onboarding`: Tracks current stage, status, version, selected Stage 2 questions, and an answers snapshot for quick access.
- `onboarding_responses`: Stores per-question answers keyed by stage; upserted on every autosave.
- `onboarding_questions`: Source of truth for prompts and requirements; Stage 2 question bank feeds adaptive selection.

## Configuration
- Questions and requirements are stored in `config/onboarding-questions.json`.
- Feature relies on Supabase tables delivered through migrations `009_onboarding_tables.sql`–`011_onboarding_questions.sql` (see `docs/runbooks/onboarding-migrations.md`).
- Dev playground is reachable at `/dev/onboarding` when `NEXT_PUBLIC_IFS_DEV_MODE=true`.

## Testing & QA
- Unit coverage lives in `lib/onboarding/__tests__` (scoring, selector, summary builder).
- For manual QA use the dev playground to seed responses, then hit `/onboarding` to confirm summary rendering.
- Validate `CompletionSummary` payloads via `scripts/tests/unit/onboarding-summary.test.ts` (if added) or by logging the response before continue.

## Operational notes
- When updating questions, run the migrations and regenerate `config/onboarding-questions.json`
- After schema changes, re-run the onboarding migrations runbook and verify summary backfill (see below).
- Markdown write paths have been removed from onboarding completion; verification should look for a new `observations` row rather than markdown file mutations.
- Observation metadata now stores the full Q/A pairs (`question_answers`) alongside the structured summary for downstream agents; keep this shape in sync when adding or renaming questions.
- Capture updated screenshots of the completion summary for product/marketing docs whenever major copy changes land.
