---
title: Feature: Guided Check-ins
owner: @brandongalang
status: shipped
last_updated: 2025-08-31
feature_flag: null
code_paths:
  - app/check-in/morning/page.tsx
  - app/check-in/evening/page.tsx
  - components/check-in/DailyCheckInForm.tsx
  - lib/supabase/middleware.ts
related_prs:
  - #36
---

## What
Structured morning and evening flows guiding users through self-reflection with quick mood/energy/intention scans and lightweight notes.

## Why
Provides a gentle, repeatable practice to capture mood, intentions, and observations.

## How it works
- Next.js routes under /check-in/morning and /check-in/evening
- Morning flow collects emoji-based ratings for mood, energy, and intention focus, plus “what’s on your mind?” and an intention note
- Evening flow replays morning context, generates a short reflective prompt using OpenRouter, and captures reflections, gratitude, and extra notes
- Optional multi-select chips let users mark active parts (when parts exist); new parts are nudged toward chat or the free-text note
- Form submissions persist via Supabase with structured `parts_data` blobs for downstream agents
- Auth middleware ensures session enforcement for protected routes

## Data model
- `check_ins` table stores numeric mood/energy scores, textual reflection fields, and JSONB `parts_data.daily_responses` with emoji metadata, generated prompts, and selected part ids

## Configuration
- No special flags by default; uses standard auth/session settings

## Testing
- Unit tests for form validation where applicable; Playwright for end-to-end completion

## Operational notes
- Consider rate limiting and UX for repeated submissions
