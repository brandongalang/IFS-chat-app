---
title: Feature: Guided Check-ins
owner: @brandongalang
status: shipped
last_updated: 2025-08-31
feature_flag: null
code_paths:
  - app/check-in/morning/page.tsx
  - app/check-in/evening/page.tsx
  - components/check-in/morning-form.tsx
  - components/check-in/evening-form.tsx
  - lib/supabase/middleware.ts
related_prs:
  - #36
---

## What
Structured morning and evening flows guiding users through self-reflection.

## Why
Provides a gentle, repeatable practice to capture mood, intentions, and observations.

## How it works
- Next.js routes under /check-in/morning and /check-in/evening
- Form components capture responses and persist via Supabase
- Auth middleware ensures session enforcement for protected routes

## Data model
- check_ins (or equivalent) table storing responses with timestamps

## Configuration
- No special flags by default; uses standard auth/session settings

## Testing
- Unit tests for form validation where applicable; Playwright for end-to-end completion

## Operational notes
- Consider rate limiting and UX for repeated submissions
