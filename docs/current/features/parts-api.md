---
title: Feature: Parts API
owner: @brandongalang
status: shipped
last_updated: 2025-10-12
feature_flag: null
code_paths:
  - app/api/parts/route.ts
  - lib/supabase/clients.ts
related_prs:
  - #TBD
---

## What
Simple API endpoint to retrieve user's parts data for client-side consumption.

## Why
Provide a lightweight way for frontend components to fetch parts information without going through the agent tools layer.

## How it works
- GET endpoint that returns user's parts with id, name, and visualization data
- Ordered by last_active date (most recent first)
- Requires user authentication

## Data model
Returns parts from the `parts` table filtered by user_id with columns: id, name, visualization

## Configuration
- No feature flags required
- Uses standard user authentication via Supabase
