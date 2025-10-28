---
title: Feature: Insights (Phase 2)
owner: @brandongalang
status: beta
last_updated: 2025-10-24
feature_flag: null
code_paths:
  - app/api/insights/*
  - lib/insights/generator.ts
  - app/api/cron/generate-insights/route.ts
  - vercel.json
related_prs:
  - #41
---

## What
Phase 2 feature for generating insights and patterns across user sessions and parts over time. The automated cron pipeline now generates daily insights in production while remaining agent and UI integrations continue to iterate.

## Why
Surface trends and patterns across sessions and parts over time.

## How it works
- API routes exist for requesting insights and a cron endpoint for generation
- `mastra/workflows/generate-insight-workflow.ts` orchestrates research + writing using the shared insight generator agent with centralized model configuration
- lib/insights/generator.ts contains placeholder logic pending full implementation

## Data model
- insights table (or equivalent) reserved; exact schema may evolve

## Configuration
- Daily Vercel Cron schedule hits `/api/cron/generate-insights` at **08:10 UTC** (`vercel.json`)
- Runs shortly after the 08:00 UTC memory-update job completes (which handles memory snapshots and digest updates)
- Cron requests reuse the shared `CRON_SECRET` header handled by `requireCronAuth`

## Testing
- Smoke scripts available via npm run smoke:insights

## Operational notes
- Monitor Vercel Cron logs (`vercel -> Settings -> Cron Jobs -> generate-insights`) for non-200 responses—there are no automatic retries
- Use `npm run smoke:insights` after deployments that touch the workflow to confirm the cron can still enqueue summaries
- Keep the workflow idempotent; the handler skips users within the configured cooldown window and silently ignores empty outputs
