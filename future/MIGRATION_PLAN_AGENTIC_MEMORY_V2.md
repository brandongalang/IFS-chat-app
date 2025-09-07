# Migration Plan: Agentic File-First Memory v2

Status: Draft (concept-only)
Date: 2025-09-07
Owners: Product + Eng (Data, Backend, Agent)

Objective
Migrate from the current DB-centric model (Mastra tools + agent_actions) to an agentic, file-first working model (A3 + B3) with Postgres-first, structured, append-only events for audit and reconstruction. The end user never sees file ops; the agent edits behind the scenes. Keep main green, ship in small PRs, and stage rollout via flags.

Guiding principles
- Freedom with guardrails: Agent can grep/read/patch within allowed paths (no deletes), with lint warnings for caps/format and hard blocks for dangerous ops.
- Single source of audit truth: All writes (file-affecting or not) produce structured Postgres events; files remain the readable “truth surface,” events the immutable ledger.
- Deterministic recovery: Snapshots + events allow reconstruction at any cutoff. Drift is detected and queued for maintainer review (never the end user).
- No big bang: Dual-write first, then progressively enable reads/writes from the new toolbelt.

Current state (abridged)
- Mastra tools call Supabase directly; agent_actions logs DB mutations with rollback capability.
- No structured events table; some narrative content lives in DB; no canonical file snapshots.
- user_memory snapshots (JSON Patch) exist but aren’t the agent’s working surface.

Target state (abridged)
- Toolbelt (A3 + B3): fs.*, md.*, events.*, lint.*. No delete; anchors/frontmatter protected; warn-only for caps/length; rationale required on cap overrides.
- Postgres-first events: events table with typed core columns + JSONB. No partitioning for MVP (4B). Indexes as specified. Idempotency and integrity HMAC.
- Files: user/part/relationship/notes as Markdown with hidden anchors; profile/history copies on edits.
- Correlation: transaction_id + tool_call_id + (optional) agent_action_id for DB changes.

Phased rollout

Phase 0 — Flags, ADRs, scaffolding (1 PR)
- Add feature flags (config only; no behavior change):
  - memory.agentic_v2.enabled
  - memory.agentic_v2.ingest_only (default true)
- Land ADR/doc set (already created in /future): decisions, grammar/rules, tool API, data schema.
- Acceptance: CI green; no runtime changes.

Phase 1 — DB migrations (1–2 PRs)
- Create events table and idempotency_records (see future/DATA_SCHEMA.md). No partitioning (4B). Add recommended indexes.
- Add RLS: owner-only reads; writes via service role only. Confirm policies in Supabase Studio.
- Configure env for integrity HMAC:
  - MEMORY_EVENTS_HMAC_SECRET (server-only)
  - MEMORY_EVENTS_SALT_VERSION=v1
- Acceptance: Migrations apply cleanly locally and in staging; basic insert/select via smoke script.

Phase 2 — Server plumbing (1–2 PRs)
- Add canonicalization + HMAC utilities (normalize LF, trim trailing whitespace, final newline; HMAC-SHA256 with salt_version).
- Add idempotency helper (scope hash; 48h TTL record with outcome).
- Add events logger module:
  - Insert status='pending' → perform write → status='committed' OR 'failed'.
  - Include lint summary (warnings, overrides); compute before/after hashes for section edits.
- Acceptance: Unit tests for canonicalization, HMAC, idempotency, and saga transitions.

Phase 3 — File grammar scaffolding (1–2 PRs)
- Add md.* helpers: list_sections, patch_section, curate_list, snapshot_history, lint.
- Add fs.* helpers: list, read, search (grep), hash, write, patch, append (no delete).
- Provide templates for user/part/relationship profiles (anchors + canonical H2s). Add a tiny linter for anchors/caps.
- Acceptance: Unit tests for md/fs helpers, lint rules.

Phase 4 — Dual-write (ingest-only) (1–2 PRs)
- Wrap existing Mastra tools so that any write they perform also calls events.log with:
  - type/op, section_anchor (if applicable), rationale, evidence refs, before/after hashes (when available), lint, idempotency.
- Keep agent_actions exactly as-is for DB rollback.
- memory.agentic_v2.ingest_only=true: No read-path changes yet; agent continues DB-based reads where it does today.
- Acceptance: Smoke route to trigger a representative set of tool calls and verify events inserted with correct correlation.

Phase 5 — Snapshot scaffolding and backfill (1–2 PRs)
- Script A: scaffold snapshots for existing users/parts/relationships:
  - Create users/{userId}/overview.md with minimal sections and anchors.
  - Create parts/{partId}/profile.md and relationships/{relId}/profile.md with minimal content derived from DB.
  - Write history copies once initial content is created.
- Script B: backfill events from recent agent_actions (e.g., last 30–90 days):
  - Map action_type → {type, op}; store rationale from metadata when present; link agent_action_id.
  - For backfill where before/after hashes are unknown, set them null and mark lint.warnings += ["backfill:no-hash"] for transparency.
- Acceptance: Backfill runs in staging across a sample; sanity-check replay for a few parts vs. expected state.

Phase 6 — Read path (behind flag) (1 PR)
- Implement get_part_data to read from files + last N events for context. Keep legacy read methods as fallback.
- memory.agentic_v2.enabled=false by default; enable for an internal cohort (e.g., dev personas) to validate.
- Acceptance: End-to-end dev flow uses file snapshots and events successfully for test users.

Phase 7 — Agent writes via new toolbelt (flagged) (1–2 PRs)
- Introduce fs.* and md.* tools to the agent; update prompts to prefer grammar-aware writes (patch_section/curate_list) and use fs.patch/write for advanced cases.
- Hard blocks enforced by server (no delete, anchor/frontmatter edits, out-of-scope writes).
- Keep ingest_only=true for a brief soak while writes go through new code paths.
- Acceptance: Lint warnings captured with override rationales where caps exceeded; events committed; snapshots updated.

Phase 8 — Observability and alerts (1 PR)
- Metrics: event_commit_rate, event_fail_rate, lint_warning_rate, hash_mismatch_count, replay_latency_p95.
- Alerts: sustained event_fail_rate, integrity mismatch spikes, lint_warning_rate spikes.
- Dashboards to monitor cohort rollout.
- Acceptance: Dashboards reflect test traffic; alert thresholds tuned.

Phase 9 — Gradual enablement (config-only PRs)
- Rollout memory.agentic_v2.enabled to 5% → 25% → 50% → 100%.
- Keep ingest_only=true until stable; then set ingest_only=false and rely fully on file-first writes.
- Acceptance: Error rates within SLO; user-facing UX stable.

Phase 10 — Cleanup and docs (1 PR)
- Document deprecations of certain legacy write paths (if any) and where files now own the narrative truth.
- Add runbooks: drift incident handling, HMAC key rotation, idempotency cleanup, backfill playbook, and recovery from failed saga.
- Acceptance: Docs reviewed; onboarding updated.

Key mappings (agent_actions → events)
- action_type → events.type/op examples:
  - create_emerging_part → { type: 'action', op: 'append_item' } + profile seed; or profile_update if we immediately write profile
  - update_part_confidence → { type: 'action' } (non-file event unless mirrored in snapshot summary)
  - update_part_category → { type: 'profile_update', op: 'replace_section', section_anchor: 'identity v1' }
  - add_part_evidence → { type: 'profile_update', op: 'append_item', section_anchor: 'evidence v1' }
  - acknowledge_part → { type: 'action' } (and optionally summary change in profile)
- Rationale: prefer profile_update events when the profile actually changes; else action or audit.

Risk management
- Orphan divergence: files vs events out-of-sync → Saga status ensures visibility; reconciliation job can scan pending/failed states.
- Anchor drift: bounded re-anchor once, else queue maintainer review; never task end user.
- Lint bloat: recurring warnings flagged; curation policies and reminders.
- Performance: tune indexes; add partial/GIN only as needed; consider partitioning later.

Operational runbooks (summaries)
- HMAC rotation: bump salt_version; deploy new secret; old rows remain verifiable by version.
- Drift/Integrity incident: freeze writes for affected user; replay to last good; manual review of snapshot.
- Idempotency cleanup: daily delete of expired idempotency_records; metrics for collision.
- Backfill rerun: idempotent by design using scope hashes and explicit backfill markers.

Acceptance criteria per phase
- Each phase has: (a) unit/integration tests green, (b) lint/type-check/test in CI, (c) a short smoke script.
- No pushes to main without passing checks; use feature branches with Conventional Commits and small PRs.

Timeline (strawman)
- P0–P2: 3–5 days (docs, migrations, plumbing)
- P3–P4: 3–5 days (grammar + dual-write + backfill scripts)
- P5–P7: 5–7 days (read path + agent writes + cohort validation)
- P8–P10: 3–5 days (obs, rollout, cleanup)

Deliverables & scripts
- Migrations: supabase/migrations/0xx_events.sql, 0xx_idempotency.sql
- Utilities: lib/memory/events-logger.ts, lib/memory/canonicalize.ts, lib/memory/idempotency.ts
- Tools: server modules for fs.*, md.*, events.*, lint.* (as per future/TOOL_API_SPEC.md)
- Scripts:
  - scripts/scaffold-snapshots-from-db.ts
  - scripts/backfill-events-from-agent-actions.ts
  - scripts/smoke-memory-v2.ts

Open questions (track in issue)
- Exact mapping for all action_type values to events (complete the table)
- Minimum viable lint rule set (which warnings first?)
- Evidence extraction heuristics for backfill (quotes vs tokens)

