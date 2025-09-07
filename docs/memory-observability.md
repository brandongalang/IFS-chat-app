# Memory v2 Observability and Guardrails

This page explains how we observe and debug Memory v2 snapshot reads, and what to do if something fails.

What is logged
- Structured JSON lines to stdout with tag MemoryV2 and event snapshot_usage.
- Fields:
  - ts: ISO timestamp
  - kind: overview | part_profile | relationship_profile
  - status: hit | miss | error
  - latency_ms: optional timing for the read
  - user_id, part_id, rel_id: when applicable
  - error: string when an exception occurs

Where logs are emitted
- lib/data/parts.ts when MEMORY_AGENTIC_V2_ENABLED=1 and snapshot reads are attempted:
  - getPartById: logs part_profile hit/miss/error
  - getPartDetail: logs overview and part_profile; logs each relationship_profile
  - getPartRelationships: logs each relationship_profile

How to view
- Locally: run any flow that calls the above functions, then grep the dev server logs:
  - grep -F '"tag":"MemoryV2"' .next/server/logs/*  (or your process logs)
- In CI or production: ship stdout to your log sink and filter tag=MemoryV2.

Interpreting
- hit: snapshot file exists and was parsed into a section map
- miss: snapshot file not found or empty (non-fatal; system continues)
- error: exception during read/parse; check error field and upstream adapter config (paths, bucket, permissions)

Runbook: common issues
1) Misses across the board
- Likely snapshots were not scaffolded yet. Run the scaffold script to create baseline snapshots and retry.

2) Errors for relationship_profile only
- Some relationships may lack profiles; this is expected early in rollout. Consider backfilling or letting usage create them over time.

3) Access errors with Supabase adapter
- Verify: SUPABASE_* envs loaded, storage bucket memory-snapshots exists, policies allow service role writes and appropriate reads.

4) Grammar/lint errors
- Use the md linter and editor helpers to auto-fix anchors/headers; re-run the scaffold.

KPIs to watch
- Snapshot hit rate (per kind)
- Read latency (p95)
- Error rate < 1%

Notes
- Observability is best-effort and never blocks user flows.
- Keep feature usage behind MEMORY_AGENTIC_V2_ENABLED until metrics look healthy.

