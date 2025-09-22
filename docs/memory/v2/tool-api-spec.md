# Tool API Spec — Agentic File-First Memory (A3 + B3)

Status: Draft (concept-only)
Date: 2025-09-07

Purpose
This document specifies the agent’s toolbelt for working with a user’s “garden” of files (profiles, relationships, notes) while logging all actions as structured events in Postgres. The user never sees these mechanics; the agent acts behind the scenes.

Safety model (A3 + B3)
- Freedom: The agent can read, grep, and patch files within allowed paths.
- Hard blocks: No file deletions; do not alter/remove hidden anchors; do not edit identity frontmatter (ids, participants, schema); do not write outside allowed paths.
- Lint warnings (non-blocking): exceeding soft caps (evidence > 7), long sections, non-canonical headings, minor format drift. Exceeding caps requires a one-line override rationale captured in the event and the Change Log.
- Auditability: Every write emits a structured Postgres event with idempotency, integrity HMAC, and lint summary. Profile/relationship edits also write a timestamped history copy.
- Saga: Events recorded with status pending → written → committed (or failed), enabling reconciliation.

Allowed path roots (per user)
- users/{userId}/overview.md
- users/{userId}/notes.md
- users/{userId}/parts/{partId}/profile.md
- users/{userId}/parts/{partId}/notes.md
- users/{userId}/relationships/{relId}/profile.md
- users/{userId}/relationships/{relId}/notes.md

Hidden anchors and headings
- Canonical H2 headings for core sections; hidden anchor IDs on the line immediately following (e.g., <!-- @anchor: concerns v1 -->). Tools target anchors; headings remain human-friendly.

Tool families

1) Raw FS tools (developer power; no delete)
- fs.list(path, glob?): string[]
- fs.read(path, ranges?): string | { rangeSlices }
- fs.search(root, pattern, opts?): Array<{ path: string; line: number; match: string }>
- fs.hash(path, sectionAnchor?): string  // canonicalized hash of file or section
- fs.ensure_dir(path): void
- fs.write(path, content, opts?: { ifMatch?: string }): { newHash: string }
- fs.append(path, text): { newSize: number }
- fs.patch(path, diffText): { newHash: string }   // unified diff-like operations
- fs.move(path, newPath): { ok: boolean }         // maintainer-only (not exposed to agent by default)

2) Markdown grammar tools (anchor-aware)
- md.list_sections(path): Array<{ anchor: string; heading: string; startLine: number }>
- md.patch_section(path, sectionAnchor, change: { replace?: string; append?: string }, opts?): { beforeHash: string; afterHash: string }
- md.curate_list(path, sectionAnchor, ops: Array<'append' | 'prune' | 'merge'>, items, reason): { beforeHash: string; afterHash: string }
- md.snapshot_history(path): { historyPath: string }  // write timestamped copy
- md.lint(path): { warnings: string[]; blocked: boolean; blockedReasons?: string[] }

3) Events and lint (Postgres-first logs)
- events.log(input): { eventId: string }
  - Writes a structured row to Postgres with:
    - idempotency scope hash; integrity HMAC; lint summary; correlation IDs (tool_call_id, transaction_id, agent_action_id)
    - status pending → committed after write succeeds
- events.query(filters): { rows: Event[] }
  - Minimal tool for reviewers or future agent usage; not required for normal flow
- lint.check(path): alias for md.lint with policy severity; returns diagnostics used in events.log

4) Optional: propose_change (dry run)
- propose_change(input): { diff: string; safetyReport: string; requiresApproval: false }
  - Non-blocking helper for the agent to preview edits; not required to proceed

Contracts and policies

Blocked operations (hard fail)
- Delete any file.
- Remove or alter hidden anchors.
- Edit identity frontmatter (id, user_id, participants, schema version).
- Write outside allowed path roots.

Warn-only (requires override rationale when exceeding caps)
- Evidence section > 7 items.
- Narrative sections longer than ~200–400 words.
- Non-canonical headings (agent should auto-fix when possible).
- Minor whitespace/format drift.

Idempotency
- Scope key = hash(userId, toolName, entityId, payload-shape). TTL ~48h in idempotency_records.
- If caller provides idempotencyKey, it is stored and used as the primary key for dedupe; otherwise we compute the scope key.

Integrity (HMAC)
- Compute line_hash using HMAC-SHA256 over canonicalized content (normalize LF, trim trailing whitespace, ensure final newline; section-level if applicable). Store integrity_salt_version; rotate keys via deployment.

Saga status
- events.log inserts row with status = 'pending' (including lint info and intended changes). After the write succeeds, update to 'committed' and fill after_hash.
- On failure, mark 'failed' with error details; the agent may retry with same idempotency record.

Typical flows (examples)

Profile section update
1) Agent fs.read profile.md; md.list_sections; choose 'concerns v1'.
2) Prepare text; md.patch_section(...). Compute before/after hashes.
3) md.snapshot_history(profile.md) → history copy.
4) md.lint(profile.md); if warnings include caps exceeded, add one-line override rationale.
5) events.log({ type: 'profile_update', op: 'replace_section', section_anchor: 'concerns v1', rationale, evidence_refs, before_hash, after_hash, file_path, ... }) → status pending → committed.
6) Append line to Change Log (material edit).

Add evidence item
- md.curate_list('evidence v1', op='append', item with short quote + ev: token).
- Lint; events.log(type='profile_update', op='append_item', ...).

Grep and note capture
- fs.search for patterns across notes and profiles; fs.append to notes.md → events.log(type='observation', op='append_section', rationale='captured theme in notes').

Security & RLS
- Tools run server-side with service-role credentials; clients never write files or events directly.
- RLS on events table: owner-only reads; service role writes.

Return shapes (indicative)
- events.log → { eventId }
- md.patch_section → { beforeHash, afterHash }
- md.snapshot_history → { historyPath }
- md.lint → { warnings[], blocked, blockedReasons? }

Notes
- User never sees file operations; they experience higher-quality insights and up-to-date profiles.
- All actions remain reconstructable and auditable through Postgres events + snapshot history copies.

