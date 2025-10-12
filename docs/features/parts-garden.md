---
title: Feature: Parts Garden
owner: @brandongalang
status: shipped
last_updated: 2025-10-12
feature_flag: ENABLE_GARDEN
code_paths:
  - app/garden/page.tsx
  - app/garden/[partId]/page.tsx
  - components/garden/PartActions.tsx
  - mastra/tools/part-tools.ts
related_prs:
  - #41
---

## What
Visual exploration interface for browsing and drilling into Parts.

## Why
Offers a spatial/visual way to understand internal parts and relationships.

## How it works
- Detail at app/garden/[partId]/page.tsx (server)
  - Reads narrative content from the Markdown repository (`lib/parts/repository`): sections like Role & Purpose, Current State, Origin
  - Reads DB-backed fields (visualization, relationships, notes) via `@/lib/data/parts-server`
- PartActions server actions import from `@/lib/data/parts-server` and update DB attributes (e.g., name/emoji via visualization)
- Part tool invocations route through tightened Zod schemas and an injected Supabase client, preventing untrusted payloads from mutating data

## Data model
- Dual storage model:
  - Markdown repository for narrative content (sections) and optional emoji in frontmatter
  - Database tables/views for identity, visualization, relationships, and notes

## Configuration
- Enabled by default via `config/features.ts`. Environments that need to hide the Garden must set `ENABLE_GARDEN` to a falsey value (`false`, `0`, or `off`). The feature flag is read during build, with optional support for mirroring via `NEXT_PUBLIC_ENABLE_GARDEN` when client overrides are required.

## Testing
- Unit tests for helper logic; Playwright for navigation (overview → detail)

## Operational notes
- Confirm flag defaults and access control for non-authenticated users
