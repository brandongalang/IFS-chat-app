---
title: Feature: Insights (Scaffolding)
owner: @brandongalang
status: experimental
last_updated: 2025-08-31
feature_flag: null
code_paths:
  - app/api/insights/*
  - lib/insights/generator.ts
  - app/api/cron/generate-insights/route.ts
related_prs:
  - #41
---

## What
Initial scaffolding for insights generation (e.g., scheduled or on-demand summaries/patterns).

## Why
Surface trends and patterns across sessions and parts over time.

## How it works
- API routes exist for requesting insights and a cron endpoint for generation
- lib/insights/generator.ts contains placeholder logic pending full implementation

## Data model
- insights table (or equivalent) reserved; exact schema may evolve

## Configuration
- Cron setup and permissions documented in code; review before enabling

## Testing
- Smoke scripts available via npm run smoke:insights

## Operational notes
- Treat as behind a manual switch; do not enable broadly until core logic is complete
