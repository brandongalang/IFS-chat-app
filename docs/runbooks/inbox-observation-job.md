# Runbook: Inbox Observation Generation Job

This runbook captures how to execute and monitor the inbox observation generation workflow that hydrates `inbox_observations` and related events.

## Overview
- Script: `npm run inbox:generate`
- Purpose: generate fresh observations for a list of users, respecting inbox queue capacity and dedupe windows
- Outputs:
  - New rows in `inbox_observations`
  - Delivery + confirmation/dismissal events in `observation_events`
  - Job metadata in `inbox_job_runs`
  - Tool telemetry in `inbox_observation_telemetry`

## Prerequisites
- Environment variables loaded (e.g., `.env.local`):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - Mastra provider settings (`OPENROUTER_API_KEY`, `IFS_MODEL`, `IFS_TEMPERATURE`)
- Supabase migrations up to `107_inbox_observation_telemetry.sql`
- Optional: pass `--queue` or `--window` flags to override defaults (3 slots / 14-day dedupe)

## Usage
```bash
npm run inbox:generate -- --limit 10
npm run inbox:generate -- --user <uuid>
npm run inbox:generate -- --queue 5 --window 21
```
- `--user <uuid>`: process a single user
- `--limit <n>`: process first `n` users (ordered by `users.created_at`)
- `--queue <n>`: override queue capacity per user
- `--window <n>`: override dedupe lookback (days)

## Monitoring & Telemetry
- Job summary printed to stdout with inserted/skipped/error counts
- `select * from inbox_job_runs order by started_at desc limit 5;`
- `select * from inbox_observation_telemetry order by created_at desc limit 20;`
- `select * from inbox_observations order by created_at desc limit 5;`
- Inspect observation events: `select * from observation_events order by created_at desc limit 10;`

## Failure recovery
1. If the script exits early, re-run with the same flags; dedupe logic prevents duplicate observations.
2. For persistent Supabase failures, confirm credentials and RLS policies (tables: `inbox_observations`, `observation_events`, `inbox_job_runs`).
3. Use `--user` to isolate problematic records before scaling to the full user list.
