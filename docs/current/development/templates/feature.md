---
title: Feature: <name>
owner: @<owner>
status: shipped | behind-flag | experimental
last_updated: 2025-08-31
feature_flag: <FLAG_NAME> | null
code_paths:
  - app/<...>
  - components/<...>
  - lib/<...>
related_prs:
  - <#NN | short sha>
---

## What
Short description of the feature and user value.

## Why
Problem it solves; link PRD if applicable.

## How it works
- Architecture and flow
- Routes/components/hooks/APIs
- Background jobs/cron if any

## Data model
Tables, columns, migrations, constraints.

## Configuration
- Flags and defaults
- Required env vars (names only)

## Testing
- Unit tests and coverage anchors
- E2E (Playwright) scenarios

## Operational notes
Rollout steps, known issues, monitoring.
