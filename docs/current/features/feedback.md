---
title: Feature: Message Feedback
owner: @brandongalang
status: shipped
last_updated: 2025-10-12
feature_flag: null
code_paths:
  - app/api/feedback/route.ts
  - lib/supabase/clients.ts
related_prs:
  - #TBD
---

## What
API endpoint for users to provide feedback on chat messages with thumbs up/down ratings and optional explanations.

## Why
Collect user feedback on agent responses to improve the system and track user satisfaction with specific interactions.

## How it works
- Accepts POST requests with sessionId, messageId, rating (thumb_up/thumb_down), and optional explanation
- Stores feedback in the `message_feedback` table
- Requires user authentication

## Data model
- `message_feedback` table with session_id, message_id, user_id, rating, explanation, created_at

## Configuration
- No feature flags required
- Uses standard user authentication via Supabase
