# Agentic File-First Memory v2: Decisions

Status: Draft (concept-only; pre-implementation)
Date: 2025-09-07

This document records the product-level decisions for the agentic, file-first memory system. It is intentionally independent of implementation so the agent can be guided by stable rules while we iterate.

Definitions
- Maintainer: trusted internal role or automated review process (not the end user) responsible for schema governance and resolving drift conflicts. Users should not manage schema.

Decisions

1) Evidence inside snapshots
- Choice: Hybrid curated refs + short quotes + event tokens
- Details: Keep a dedicated “Evidence (curated)” section in snapshots with up to 7 items, each containing a brief quote and a resolvable event token (e.g., ev:YYYYMMDDThhmmssZ-ULID). Avoid full raw logs in snapshots.
- Rationale: Balances readability and auditability; avoids bloat while maintaining enough context.

2) Section set per file
- Choice: Core sections + “Extensions” section
- Details: Profiles (user, part, relationship) use a stable set of core sections. An “Extensions” section allows the agent to experiment with new fields without changing core schema.
- Rationale: Keeps the core contract stable while allowing evolution.

3) Schema governance
- Choice: Agent uses Extensions; maintainers review and promote to core later
- Details: The agent can propose new fields in Extensions. Only maintainers (not end users) decide if/when a field is promoted to the core schema after review and rule updates.
- Rationale: Prevents schema drift and keeps burden off users.

4) Change Log granularity
- Choice: Daily rollup + material inline entries
- Details: Auto-generate a daily summary from the event ledger. Also write inline Change Log entries for material changes (e.g., status/category changes; major profile edits).
- Rationale: Keeps logs readable without losing important provenance.

5) Notes scope
- Choice: One notes.md per entity (user, part, relationship) with subsections
- Details: Contain ad hoc thinking in a single notes.md per entity. Use subsections (e.g., Inbox, Focus, Parking Lot). Cap section sizes via soft limits.
- Rationale: Prevents file sprawl while allowing rich context.

6) Drift policy (replay vs. snapshot mismatch)
- Choice: Bounded auto re-anchor once, else halt-and-review by a maintainer
- Details: If a section anchor or hash cannot be matched exactly during replay, attempt one bounded fuzzy re-anchor (e.g., canonical section name nearby). If that fails, stop replay for that file, flag drift, and queue for maintainer review. Do not ask the end user to resolve schema/data.
- Rationale: High integrity without sacrificing availability for minor mismatches.

7) Anchors
- Choice: Canonical H2 section names + hidden anchor IDs
- Details: Human-friendly H2 headings (canonical names) plus a hidden machine-stable anchor marker at the start of each section. Linting enforces names/anchors.
- Rationale: Readable for humans, robust for tools.

8) Targeting granularity
- Choice: Section-level edits for narrative; item-level for list sections
- Details: Replace/append whole sections for narrative content. For list-like sections (Evidence, Highlights), allow item-level append/prune (curation with reasons).
- Rationale: Balanced precision with simplicity.

9) Ordering
- Choice: Fixed order for core sections; optional sections at bottom
- Rationale: Predictable parsing and consistent UI.

10) Headings
- Choice: H1 title; H2 sections; H3 subsections (canonical names)
- Rationale: Simple, lintable hierarchy.

11) File naming
- Choice: slug + id directory names (e.g., inner-critic--{partId}/profile.md)
- Rationale: Human-friendly while remaining stable.

12) Relationship modeling and groups
- Choice: One file per relationship edge (pair + type) as canon.
- Groups/patterns: Start with (1) derived-only from edges and (3) summarize significant patterns in the User Overview (e.g., “two protectors polarized around an exile”).
- Rationale: Keeps MVP simple and explicit; provides a clear evolution path to pattern files later if needed.

13) Allowed operations
- Choice: Narrative sections → replace or append; list sections → append and curate (prune with reason). No file deletion; use tombstones with reasons when deprecating content.
- Rationale: Clear mental model and strong auditability.

14) Evidence refs cap
- Choice: Cap at 7 curated evidence items per snapshot
- Rationale: Modern context windows are large, but snapshots should remain concise. The event ledger remains the full history.

15) Timestamps
- Choice: ISO 8601 UTC for frontmatter and Change Log
- Rationale: Unambiguous and consistent across systems.

16) Length discipline
- Choice: Soft caps with linter warnings; exceeding caps requires a rationale
- Details: If the agent exceeds a section’s soft cap (e.g., Evidence > 7, Summary > target length), it must include a short structured “override rationale” in the write event metadata and a one-line note in the Change Log describing why, for how long, and the plan to prune back.
- Rationale: Preserves discipline while permitting justified exceptions.

Notes
- End users are not responsible for schema decisions. They may pin/lock content and approve/reject agent proposals, but schema evolution is a maintainer concern.
- All writes are logged as structured, append-only events with idempotency and integrity hashes; snapshots remain the readable “truth surface.”

