---
title: Feature: Insights (Phase 2)
owner: @brandongalang
status: in_development
last_updated: 2025-10-12
feature_flag: null
code_paths:
  - app/api/insights/*
  - lib/insights/generator.ts
  - app/api/cron/generate-insights/route.ts
related_prs:
  - #41
---

## What
Phase 2 feature for generating insights and patterns across user sessions and parts over time. Currently in active development with API scaffolding in place.

## Why
Surface trends and patterns across sessions and parts over time.

## How it works
- API routes exist for requesting insights and a cron endpoint for generation
- `mastra/workflows/generate-insight-workflow.ts` orchestrates research + writing using the shared insight generator agent with centralized model configuration
- lib/insights/generator.ts contains placeholder logic pending full implementation

## Data model
- insights table (or equivalent) reserved; exact schema may evolve

## Configuration
- Cron pipeline not yet enabled; when ready wire through `vercel.json` (similar to memory-update cron) and provision its own `CRON_SECRET`

## Testing
- Smoke scripts available via npm run smoke:insights

## Operational notes
- Treat as behind a manual switch; do not enable broadly until core logic is complete
