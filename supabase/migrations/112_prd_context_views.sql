-- PRD Context Layer
-- Migration: 112_prd_context_views
-- Description: Create computed views and materialized view supporting UI and agent warm-start flows.

-- =============================================================
-- Parts Display View (UI-friendly representation)
-- =============================================================

DROP VIEW IF EXISTS public.parts_display;

CREATE VIEW public.parts_display AS
SELECT
  p.id,
  COALESCE(p.name, p.placeholder, 'Unnamed Part') AS display_name,
  p.category,
  p.status,
  p.charge,
  p.data->>'emoji' AS emoji,
  p.data->>'age' AS age,
  p.data->>'role' AS role,
  p.confidence,
  p.evidence_count,
  p.needs_attention,
  p.last_active,
  p.created_at,
  (
    SELECT COUNT(*)
    FROM public.observations o
    WHERE o.user_id = p.user_id
      AND p.id = ANY(o.entities)
  ) AS observation_count,
  (
    SELECT COUNT(*)
    FROM public.part_relationships_v2 r
    WHERE r.part_a_id = p.id OR r.part_b_id = p.id
  ) AS relationship_count
FROM public.parts_v2 p;

COMMENT ON VIEW public.parts_display IS 'UI-optimized part listing derived from parts_v2 with observation and relationship counts.';

GRANT SELECT ON public.parts_display TO authenticated;
GRANT SELECT ON public.parts_display TO service_role;

-- =============================================================
-- Timeline Display View (chronological activity feed)
-- =============================================================

DROP VIEW IF EXISTS public.timeline_display;

CREATE VIEW public.timeline_display AS
SELECT
  o.created_at,
  'observation'::text AS event_type,
  o.type AS event_subtype,
  o.content AS description,
  o.entities,
  o.metadata
FROM public.observations o

UNION ALL

SELECT
  p.created_at,
  'part_created'::text AS event_type,
  p.status AS event_subtype,
  COALESCE(p.name, p.placeholder, 'New part emerged') AS description,
  ARRAY[p.id]::uuid[] AS entities,
  p.data
FROM public.parts_v2 p

UNION ALL

SELECT
  r.created_at,
  'relationship'::text AS event_type,
  r.type AS event_subtype,
  'Relationship discovered'::text AS description,
  ARRAY[r.part_a_id, r.part_b_id]::uuid[] AS entities,
  jsonb_build_object('strength', r.strength, 'context', r.context)
FROM public.part_relationships_v2 r

UNION ALL

SELECT
  t.created_at,
  'timeline_event'::text AS event_type,
  t.type AS event_subtype,
  COALESCE(t.description, 'Timeline milestone') AS description,
  t.entities,
  t.metadata
FROM public.timeline_events t

ORDER BY created_at DESC;

COMMENT ON VIEW public.timeline_display IS 'Aggregated timeline combining observations, parts, relationships, and timeline_events for UI consumption.';

GRANT SELECT ON public.timeline_display TO authenticated;
GRANT SELECT ON public.timeline_display TO service_role;

-- =============================================================
-- User Context Cache (materialized view + refresh helper)
-- =============================================================

DROP MATERIALIZED VIEW IF EXISTS public.user_context_cache;

CREATE MATERIALIZED VIEW public.user_context_cache AS
SELECT
  u.id AS user_id,

  (
    SELECT jsonb_agg(p_row)
    FROM (
      SELECT
        p.id,
        p.name,
        p.placeholder,
        p.category,
        p.status,
        p.last_active,
        p.data->>'emoji' AS emoji,
        p.needs_attention
      FROM public.parts_v2 p
      WHERE p.user_id = u.id
      ORDER BY p.last_active DESC NULLS LAST
      LIMIT 5
    ) AS p_row
  ) AS recent_parts,

  (
    SELECT jsonb_agg(pa_row)
    FROM (
      SELECT
        p.id,
        COALESCE(p.name, p.placeholder) AS display_name,
        CASE
          WHEN p.name IS NULL THEN 'needs_name'
          WHEN p.data->>'role' IS NULL THEN 'needs_role'
          WHEN p.category = 'unknown' THEN 'needs_category'
          ELSE 'needs_details'
        END AS next_step
      FROM public.parts_v2 p
      WHERE p.user_id = u.id
        AND p.needs_attention = TRUE
      ORDER BY p.updated_at DESC NULLS LAST
      LIMIT 5
    ) AS pa_row
  ) AS incomplete_parts,

  (
    SELECT jsonb_agg(f_row)
    FROM (
      SELECT
        o.content,
        o.type,
        o.created_at
      FROM public.observations o
      WHERE o.user_id = u.id
        AND o.metadata->>'followUp' = 'true'
        AND o.metadata->>'completed' IS NULL
      ORDER BY o.created_at DESC
      LIMIT 10
    ) AS f_row
  ) AS follow_ups,

  (
    SELECT to_jsonb(s_row)
    FROM (
      SELECT
        s.id,
        s.type,
        s.summary,
        s.key_insights,
        s.homework,
        s.next_session,
        s.started_at,
        s.ended_at
      FROM public.sessions_v2 s
      WHERE s.user_id = u.id
      ORDER BY s.started_at DESC NULLS LAST
      LIMIT 1
    ) AS s_row
  ) AS last_session,

  NOW() AS cache_time,
  (
    SELECT MAX(o.created_at)
    FROM public.observations o
    WHERE o.user_id = u.id
  ) AS last_observation,
  (
    SELECT COUNT(*)
    FROM public.sessions_v2 s
    WHERE s.user_id = u.id
  ) AS total_sessions

FROM public.users u;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_context_cache_user
  ON public.user_context_cache(user_id);

COMMENT ON MATERIALIZED VIEW public.user_context_cache IS 'Warm-start agent context snapshot. Refresh cadence controlled by application (no automatic schedule).';

GRANT SELECT ON public.user_context_cache TO authenticated;
GRANT SELECT ON public.user_context_cache TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_user_context_cache()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_context_cache;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.refresh_user_context_cache() IS 'Refreshes user_context_cache matview; refresh cadence controlled by application workflows.';

-- NOTE: Refresh cadence (cron/on-demand) to be defined in a later bead once agent KV cache strategy is finalized.
