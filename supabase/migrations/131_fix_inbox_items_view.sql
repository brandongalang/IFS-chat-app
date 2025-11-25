-- Fix inbox_items_view to include columns expected by the mapper
-- Migration: 131_fix_inbox_items_view
-- Purpose: Add source_type, source_id, and part_id to inbox_items_view
-- The mapper function (mapInboxRowToItem) expects these columns but they were
-- missing from the original view definition in migration 130.

DROP VIEW IF EXISTS public.inbox_items_view;

CREATE VIEW public.inbox_items_view AS
SELECT
  i.id,
  i.user_id,
  i.type,
  i.status,
  i.content,
  i.metadata,
  i.evidence,
  i.related_part_ids,
  i.source_session_ids,
  i.created_at,
  i.revealed_at,
  i.actioned_at,
  i.dismissed_at,
  -- Add missing columns for mapper compatibility
  -- Use COALESCE to default source_type to 'observation_generated' for items without one
  COALESCE(i.source_type, 'observation_generated') AS source_type,
  -- Use COALESCE so new unified items (without source_id) use their primary id
  COALESCE(i.source_id, i.id) AS source_id,
  -- Compute part_id from first element of related_part_ids array (arrays are 1-indexed in PostgreSQL)
  (i.related_part_ids[1])::uuid AS part_id
FROM public.inbox_items i
WHERE i.status IN ('pending', 'revealed')
ORDER BY i.created_at DESC;

GRANT SELECT ON public.inbox_items_view TO authenticated;
GRANT SELECT ON public.inbox_items_view TO service_role;

COMMENT ON VIEW public.inbox_items_view IS 'Unified inbox feed containing all inbox items (insights, observations, follow-ups). Includes source_type, source_id, and part_id for API mapper compatibility.';
