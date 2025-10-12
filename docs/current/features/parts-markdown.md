---
title: Feature: Parts Markdown Content Layer
owner: @brandongalang
status: in_progress
last_updated: 2025-10-11
feature_flag: null
code_paths:
  - lib/parts/spec.ts
  - lib/parts/repository.ts
  - mastra/tools/part-content-tools.ts
  - content/parts/**
related_prs:
  - #TBD
---

What
- Introduces a Markdown-first content layer for Parts with strict YAML frontmatter and sectioned Markdown bodies.
- Adds content-only tools to read/list/create/update Part markdown without touching database records.

Why
- Establish a clean separation of concerns:
  - YAML frontmatter holds structured metadata (e.g., id, name, category, status, tags, timestamps)
  - Markdown body holds narrative content (e.g., Role & Purpose, Evidence & Observations, Therapeutic Notes, Session Log)
- Lays the groundwork for a future metadata agent (in a separate task), while keeping the conversational agent focused on content.

How it works
- Spec (lib/parts/spec.ts)
  - Zod schema validates YAML frontmatter: id, name, emoji?, category, status, tags[], related_parts[], timestamps, activity_metrics?
  - Parser: text → { frontmatter, sections } using a minimal YAML subset and heading-based section splits (## Title)
  - Serializer: { frontmatter, sections } → canonical document
- Repository (lib/parts/repository.ts)
  - Files live under content/parts/*.md (or <slug>/index.md)
  - listParts(filters): read frontmatter only; filter on category, status, tag, query-by-name
  - readPartById(id): return frontmatter + sections
  - createPart({ frontmatter, sections?, fileName? }): write a new file (uuid if id omitted); timestamps auto-set
  - updatePartContent({ id, updates[] }): replace/append/prepend specific sections; updates timestamps; frontmatter otherwise untouched
- Tools (mastra/tools/part-content-tools.ts)
  - get_parts_metadata_summary: counts by category/status; global tag set
  - list_parts: discover via YAML metadata
  - read_part: read by id (frontmatter + sections)
  - create_part: create new file (frontmatter partial; sections optional)
  - update_part_content: content-only edits (no YAML mutation besides timestamps)

Out of scope
- Metadata agent, automated tag inference, relationship detection, activity metrics computation
- DB migrations or replacing DB-backed parts; this layer can be introduced alongside existing APIs

UI/UX notes
- Sections are keyed by slugified headings; if no headings are present, the entire body is stored under the "body" section
- Prefer stable section headings for predictable edits by tools

Data model
- YAML frontmatter mirrors existing enums for status and category for consistency; user identity is not persisted in files

Operational notes
- content/parts/ should be checked in where appropriate; tools operate on local files and should be gated by environment if used in production contexts
- Future PR can wire garden/check-ins to read from this repository behind a flag
