# Inbox Sync Migration: Follow-up Work

## Context

Migration 130 (`supabase/migrations/130_unified_inbox_items.sql`) consolidated `insights` and `inbox_observations` tables into a unified `inbox_items` table:

- `insights` → renamed to `insights_legacy`
- `inbox_observations` → renamed to `inbox_observations_legacy`
- `observation_events` → dropped
- New unified table: `inbox_items`

The core inbox sync functionality has been fixed, but several files still reference the legacy `insights` table and need to be updated.

## Completed

- [x] `app/api/inbox/generate/route.ts` - Switched to unified inbox engine
- [x] `mastra/tools/insight-research-tools.ts` - `getRecentInsights` now queries `inbox_items`

## Files Still Referencing Legacy `insights` Table

### High Priority (Core Functionality)

| File | Lines | Description |
|------|-------|-------------|
| `lib/data/inbox-actions.ts` | 44, 440 | Inbox action handlers - affects reveal/dismiss actions |
| `lib/memory/service.ts` | 241, 275 | Memory service - affects context building |
| `lib/insights/generator.ts` | 31 | Insight generator - affects automated insight creation |

### Medium Priority (API Routes)

| File | Lines | Description |
|------|-------|-------------|
| `app/api/insights/route.ts` | 69, 81 | Main insights API endpoint |
| `app/api/insights/request/route.ts` | 37 | Insight request endpoint |
| `app/api/insights/[id]/reveal/route.ts` | 28, 41 | Reveal action endpoint |
| `app/api/insights/[id]/feedback/route.ts` | 30, 46 | Feedback submission endpoint |

### Low Priority (Scripts/Testing)

| File | Lines | Description |
|------|-------|-------------|
| `scripts/smoke-test-insights.ts` | 19 | Test script |
| `scripts/inbox/author-insight.ts` | 115 | Manual insight authoring script |
| `scripts/import-persona-fixtures.ts` | 92 | Fixture import script |

## Migration Strategy

For each file:

1. **Identify the purpose** - Is it reading, writing, or both?
2. **Update table reference** - Change `.from('insights')` to `.from('inbox_items')`
3. **Update column mappings** if needed:
   - `meta` → `metadata`
   - Add `type` column (required in `inbox_items`)
   - Add `source_type` column for provenance
4. **Handle schema differences** - `inbox_items` has additional fields like `evidence`, `related_part_ids`, `source_session_ids`
5. **Test thoroughly** - Each endpoint should be tested after migration

## Column Mapping Reference

| Legacy `insights` | Unified `inbox_items` | Notes |
|-------------------|----------------------|-------|
| `id` | `id` | Same |
| `user_id` | `user_id` | Same |
| `type` | `type` | Same values + `question`, `pattern` |
| `status` | `status` | Same + `dismissed` |
| `content` | `content` | Same structure |
| `meta` | `metadata` | Renamed |
| `rating` | `rating` | Same |
| `feedback` | `feedback` | Same |
| `revealed_at` | `revealed_at` | Same |
| `actioned_at` | `actioned_at` | Same |
| `processed` | `processed` | Same |
| `processed_at` | `processed_at` | Same |
| `created_at` | `created_at` | Same |
| `updated_at` | `updated_at` | Same |
| - | `evidence` | New: JSON array of evidence refs |
| - | `related_part_ids` | New: UUID array |
| - | `source_session_ids` | New: UUID array |
| - | `semantic_hash` | New: deduplication hash |
| - | `confidence` | New: ML confidence score |
| - | `source_type` | New: provenance tracking |
| - | `source_table` | New: for migrated records |
| - | `source_id` | New: original ID reference |

## Notes

- The legacy tables (`insights_legacy`, `inbox_observations_legacy`) are preserved for historical reference
- RLS policies are already configured on `inbox_items`
- The `inbox_items_view` filters for `status IN ('pending', 'revealed')` for API consumption
