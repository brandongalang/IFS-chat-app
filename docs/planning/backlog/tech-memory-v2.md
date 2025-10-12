# Memory v2 — Events Ledger (Clean-Slate)

This document describes the Memory v2 baseline implemented in this repository.

What changed
- Legacy agent_actions (rollback log) and user_memory_snapshots (JSON Patch) are removed.
- A new events ledger table (public.events) records all meaningful agent actions with integrity HMAC and idempotency hooks.
- A minimal idempotency_records table supports safe retries.
- The existing action-logger has been re-wired to the events ledger under the hood. Rollback tools are removed from the agent registry for now.

Schema highlights
- events: append-only; owner-only SELECT via RLS; writes use service role.
- idempotency_records: internal table (RLS enabled; no user policies) with TTL column and outcome payload for dedupe.

Operational notes
- Set MEMORY_EVENTS_HMAC_SECRET on server; do not expose this to the client.
- Use scripts/smoke-memory-v2.ts to validate a basic insert/select roundtrip (requires service role).
- Local development can proceed without snapshots; a StorageAdapter (local vs Supabase) will be added in a follow-up PR.

Next steps
- Add StorageAdapter implementations for local development and Supabase Storage, and a minimal Markdown snapshot grammar and linter.
- Reintroduce event-backed rollback tooling (optional) and observability dashboards.

