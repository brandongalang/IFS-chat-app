---
title: Feature: Guided Check-ins
owner: @brandongalang
status: shipped
last_updated: 2025-10-07
feature_flag: null
code_paths:
  - app/check-in/morning/page.tsx
  - app/check-in/evening/page.tsx
  - components/check-in/CheckInExperience.tsx
  - components/check-in/CheckInWizard.tsx
  - components/check-in/EmojiScale.tsx
  - components/check-in/PartsPicker.tsx
  - components/home/CheckInSlots.tsx
  - app/check-in/actions.ts
  - app/api/check-ins/overview/route.ts
  - lib/check-ins/server.ts
related_prs:
  - #36
  - #275
---

## What
Structured morning and evening flows guiding users through self-reflection with quick mood/energy/intention scans, lightweight notes, and guidance to resume drafts.

## Why
Provides a gentle, repeatable practice to capture mood, intentions, and observations.

## How it works
- Next.js routes under /check-in/morning and /check-in/evening render a shared `CheckInExperience` wizard; steps vary by variant (arrive, focus, review for morning; arrive, reflect, review for evening) and now surface real-time button feedback for navigation and submissions.
- Wizard steps are composed from shared atoms (`EmojiScale`, `PartsPicker`, `MorningSummary`) and wrapped with `CheckInLayout` to provide progress, streaks, inline error states, and animated tap feedback acknowledging selections.
- Local-date helpers keep drafts, submissions, and server streak calculations aligned with the user’s timezone (no UTC drift) and broaden the overview lookback window for accurate streaks.
- Drafts auto-save to `localStorage` per date/variant so users can resume; dashboard tiles surface draft state via `components/home/CheckInSlots.tsx`.
- Server helpers in `lib/check-ins/server.ts` centralize Supabase reads/writes, including morning context hydration, prompt generation, and overview aggregation exposed at `/api/check-ins/overview`.
- Submissions post through `app/check-in/actions.ts` server actions, returning optimistic status/conflict flags for the wizard to handle toasts and redirects.
- Evening flow replays morning context (intention, parts, generated prompt) and persists reflections with link backs to the morning entry via `parts_data`.

## Data model
- `check_ins` table stores numeric mood/energy scores, textual reflection fields, and JSONB `parts_data.daily_responses` with emoji metadata, generated prompts, and selected part ids

## Configuration
- No special flags by default; uses standard auth/session settings

## Testing
- `npm run test:ui` exercises slot state wiring for the dashboard cards; CI type/lint coverage ensures wizard code stays aligned.

## Operational notes
- Consider rate limiting and UX for repeated submissions; overview endpoint currently scans a 10-day window for streak computation.
