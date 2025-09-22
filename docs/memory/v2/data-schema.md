# Data Schema — Structured Events in Postgres (No Partitioning MVP)

Status: Draft (concept-only)
Date: 2025-09-07

Purpose
This document defines the structured, append-only event logs in Postgres that capture every agent-driven file update and related actions. Files are the agent’s working medium; Postgres events are the source-of-truth ledger for auditing, reconstruction, and governance. (Optional archival/export to object storage can be added later.)

Scope
- Logs live in Postgres only for MVP (no object-storage NDJSON for logs).
- Files: user, part, relationship, and notes live under users/{userId}/... (separate storage). Edits are reflected as rows in the events table.

Core tables

1) events (append-only)
- Purpose: one row per meaningful action/observation/profile update.
- PK: event_id (ULID text) for time-sortable uniqueness.
- RLS: owner-only reads (row user_id = auth.uid()); writes via service-role only.

Suggested MVP columns
- event_id text PRIMARY KEY  -- ULID
- schema_version int NOT NULL DEFAULT 1
- ts timestamptz NOT NULL DEFAULT now()
- user_id uuid NOT NULL
- entity_type text NOT NULL CHECK (entity_type IN ('user','part','relationship','note'))
- entity_id uuid NULL  -- null for user-level events
- type text NOT NULL CHECK (type IN ('observation','action','profile_update','system','audit'))
- op text NULL CHECK (op IN ('replace_section','append_section','append_item','curate_items','tombstone_section'))
- section_anchor text NULL  -- e.g., 'concerns v1'
- file_path text NULL  -- path within users/{userId}/...
- rationale text NULL
- before_hash text NULL
- after_hash text NULL
- evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb  -- array of ev: tokens
- lint jsonb NOT NULL DEFAULT '{}'::jsonb  -- { warnings:[], overrides:[] }
- idempotency_key text NULL
- transaction_id text NULL
- tool_call_id text NULL
- agent_action_id uuid NULL
- integrity_line_hash text NOT NULL  -- HMAC of canonicalized body/section
- integrity_salt_version text NOT NULL DEFAULT 'v1'
- status text NOT NULL DEFAULT 'committed' CHECK (status IN ('pending','committed','failed'))

Notes on minimalism
- actor_kind/actor_id/actor_version omitted from MVP-core; add later if you need multi-agent analytics.
- labels/tags omitted; add via a metadata jsonb column later if necessary.

Indexes (per your selection)
- CREATE INDEX idx_events_user_ts ON events(user_id, ts DESC);
- CREATE INDEX idx_events_entity_ts ON events(user_id, entity_type, entity_id, ts DESC);
- CREATE INDEX idx_events_transaction_id ON events(transaction_id);
- CREATE INDEX idx_events_tool_call_id ON events(tool_call_id);
- CREATE INDEX idx_events_agent_action_id ON events(agent_action_id);
- -- Optional partial for targeted scans:
- -- CREATE INDEX idx_events_profile_updates ON events(type, ts DESC) WHERE type = 'profile_update';
- -- Optional GIN when needed:
- -- CREATE INDEX idx_events_evidence_gin ON events USING GIN(evidence_refs);
- -- CREATE INDEX idx_events_lint_gin ON events USING GIN(lint);

2) idempotency_records
- Purpose: dedupe retried tool calls safely.
- Columns (MVP):
  - id serial PRIMARY KEY
  - scope_hash text UNIQUE NOT NULL  -- hash(userId, toolName, entityId, payload-shape)
  - created_at timestamptz NOT NULL DEFAULT now()
  - expires_at timestamptz NOT NULL  -- ~48h TTL
  - outcome jsonb NULL  -- store last outcome for idempotent replay

- Indexes:
  - CREATE INDEX idx_idem_expires_at ON idempotency_records(expires_at);

- Cleanup: a daily job deletes expired rows. (Supabase cron or external scheduler.)

3) (Optional later) tool_calls
- Purpose: observability of tool invocations and results when deeper tracing is required.
- MVP defers this table; correlation via tool_call_id column in events is sufficient.

Integrity and canonicalization
- We compute integrity_line_hash using HMAC-SHA256(secret) over canonicalized content:
  - Normalize line endings to LF ('\n').
  - Trim trailing whitespace; ensure file ends with a final newline.
  - For section edits, hash only the section body; for whole-file ops, hash the whole body.
- integrity_salt_version supports key rotation. Keep the secret in application config (not in DB). On rotation, new events carry the new salt_version.

Saga consistency (status)
- Insert events row with status='pending' capturing intended change (before_hash, and proposed after_hash if precomputed) and lint summary.
- Perform file write (and history copy for profile/relationship snapshots).
- On success, update status='committed' and store actual after_hash.
- On failure, status='failed' with error detail. The agent may retry with the same idempotency scope.

Deterministic reconstruction
- Query events by (user_id, entity_type, entity_id, ts) up to a cutoff and fold changes onto the latest snapshot file. Use before/after hashes to validate stepwise consistency. If a section anchor cannot be found, attempt one bounded re-anchor; else stop and flag for maintainer review (never the end user).

Relationship IDs and snapshot frontmatter (recap)
- Relationship relId = deterministic hash(sorted(partA, partB) + type). Stable per pair + type.
- Snapshot frontmatter (minimal):
  - User: { id, schema: 'user_overview.v1', last_updated }
  - Part: { id, user_id, name, schema: 'part_profile.v1', status, last_updated }
  - Relationship: { id, user_id, participants: [partIdA, partIdB], type, polarity_level?, schema: 'relationship_profile.v1', last_updated }

RLS (owner-only)
- Enable RLS on events and idempotency_records.
- Policy: users can SELECT rows where user_id = auth.uid().
- INSERT/UPDATE/DELETE restricted to service role only (server-side tools).

Retention (MVP)
- Keep events indefinitely for full auditability. Add archival/export to object storage later if needed.

Migration note: No partitioning (4B)
- The MVP uses a single table (no partitioning). Migration plan to time-partition (monthly on ts) when the table grows large or time-window queries become slow.

Appendix: example event JSON (illustrative)
{
  "event_id": "01JABC...",
  "schema_version": 1,
  "ts": "2025-09-07T00:00:00Z",
  "user_id": "uuid",
  "entity_type": "part",
  "entity_id": "uuid",
  "file_path": "users/{userId}/parts/{partId}/profile.md",
  "type": "profile_update",
  "op": "replace_section",
  "section_anchor": "concerns v1",
  "rationale": "Refined based on pre-meeting anxiety pattern",
  "evidence_refs": ["ev:20250907T001204Z-01JXYZ..."],
  "before_hash": "hmac:...",
  "after_hash": "hmac:...",
  "idempotency_key": "idem-abc",
  "transaction_id": "txn-123",
  "tool_call_id": "tool-xyz",
  "agent_action_id": null,
  "integrity_line_hash": "hmac:...",
  "integrity_salt_version": "v1",
  "lint": { "warnings": ["Evidence cap exceeded (8 > 7)"], "overrides": [{"rule": "cap:evidence:7", "rationale": "Corroborating quotes across 3 sessions; prune later."}] },
  "status": "committed"
}

