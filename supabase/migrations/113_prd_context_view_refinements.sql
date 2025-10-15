-- PRD Context Layer Refinements
-- Migration: 113_prd_context_view_refinements
-- Description: Rebuild computed views with finalized column sets, expand context cache payload, and add indexes to satisfy PRD latency targets.

-- Ensure dependent function is replaced to avoid invalid references during redeploy
DROP FUNCTION IF EXISTS public.refresh_user_context_cache();

-- Drop and recreate derived relations in dependency order
DROP MATERIALIZED VIEW IF EXISTS public.user_context_cache;
DROP VIEW IF EXISTS public.timeline_display;
DROP VIEW IF EXISTS public.parts_display;

-- -----------------------------------------------------------------------------
-- Supporting indexes for refreshed views
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_parts_v2_user_last_active
  ON public.parts_v2(user_id, last_active DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_observations_user_created_at
  ON public.observations(user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Parts Display View
-- -----------------------------------------------------------------------------

CREATE VIEW public.parts_display AS
SELECT
  p.user_id,
  p.id,
  COALESCE(p.name, p.placeholder, 'Unnamed Part') AS display_name,
  p.name,
  p.placeholder,
  p.category,
  p.status,
  p.charge,
  NULLIF(p.data->>'emoji', '') AS emoji,
  NULLIF(p.data->>'age', '') AS age,
  NULLIF(p.data->>'role', '') AS role,
  p.confidence,
  p.evidence_count,
  p.needs_attention,
  p.last_active,
  p.created_at,
  COALESCE(obs.observation_count, 0) AS observation_count,
  obs.last_observed_at,
  COALESCE(rel.relationship_count, 0) AS relationship_count,
  rel.last_relationship_at
FROM public.parts_v2 p
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::integer AS observation_count,
    MAX(o.created_at) AS last_observed_at
  FROM public.observations o
  WHERE o.user_id = p.user_id
    AND p.id = ANY(o.entities)
) obs ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::integer AS relationship_count,
    MAX(r.created_at) AS last_relationship_at
  FROM public.part_relationships_v2 r
  WHERE r.user_id = p.user_id
    AND (r.part_a_id = p.id OR r.part_b_id = p.id)
) rel ON TRUE;

COMMENT ON VIEW public.parts_display IS 'UI-optimized part listing derived from parts_v2 with observation and relationship metadata.';

GRANT SELECT ON public.parts_display TO authenticated;
GRANT SELECT ON public.parts_display TO service_role;

-- -----------------------------------------------------------------------------
-- Timeline Display View
-- -----------------------------------------------------------------------------

CREATE VIEW public.timeline_display AS
SELECT
  o.user_id,
  o.created_at,
  'observation'::text AS event_type,
  o.type AS event_subtype,
  o.content AS description,
  COALESCE(o.entities, ARRAY[]::uuid[]) AS entities,
  COALESCE(o.metadata, '{}'::jsonb) AS metadata,
  o.id AS source_id,
  'observations'::text AS source_table,
  o.session_id
FROM public.observations o

UNION ALL

SELECT
  p.user_id,
  p.created_at,
  'part'::text AS event_type,
  p.status AS event_subtype,
  COALESCE(p.name, p.placeholder, 'New part emerged') AS description,
  ARRAY[p.id]::uuid[] AS entities,
  COALESCE(p.data, '{}'::jsonb) AS metadata,
  p.id AS source_id,
  'parts_v2'::text AS source_table,
  NULL::uuid AS session_id
FROM public.parts_v2 p

UNION ALL

SELECT
  r.user_id,
  r.created_at,
  'relationship'::text AS event_type,
  r.type AS event_subtype,
  COALESCE(r.context, 'Relationship discovered') AS description,
  ARRAY[r.part_a_id, r.part_b_id]::uuid[] AS entities,
  jsonb_build_object(
    'strength', r.strength,
    'context', r.context,
    'observations', r.observations
  ) AS metadata,
  r.id AS source_id,
  'part_relationships_v2'::text AS source_table,
  NULL::uuid AS session_id
FROM public.part_relationships_v2 r

UNION ALL

SELECT
  t.user_id,
  t.created_at,
  'timeline_event'::text AS event_type,
  t.type AS event_subtype,
  COALESCE(t.description, 'Timeline milestone') AS description,
  COALESCE(t.entities, ARRAY[]::uuid[]) AS entities,
  COALESCE(t.metadata, '{}'::jsonb) AS metadata,
  t.id AS source_id,
  'timeline_events'::text AS source_table,
  t.session_id
FROM public.timeline_events t

ORDER BY created_at DESC;

COMMENT ON VIEW public.timeline_display IS 'Aggregated timeline combining observations, parts, relationships, and timeline_events for UI consumption.';

GRANT SELECT ON public.timeline_display TO authenticated;
GRANT SELECT ON public.timeline_display TO service_role;

-- -----------------------------------------------------------------------------
-- User Context Cache (materialized view)
-- -----------------------------------------------------------------------------

CREATE MATERIALIZED VIEW public.user_context_cache AS
WITH relevant_users AS (
  SELECT DISTINCT user_id FROM public.parts_v2
  UNION
  SELECT DISTINCT user_id FROM public.sessions_v2
  UNION
  SELECT DISTINCT user_id FROM public.observations
  UNION
  SELECT DISTINCT user_id FROM public.part_relationships_v2
  UNION
  SELECT DISTINCT user_id FROM public.timeline_events
)
SELECT
  ru.user_id,
  COALESCE(recent_parts.recent_parts, '[]'::jsonb) AS recent_parts,
  COALESCE(needs_attention.parts_needing_attention, '[]'::jsonb) AS incomplete_parts,
  COALESCE(followups.follow_ups, '[]'::jsonb) AS follow_ups,
  COALESCE(events.recent_events, '[]'::jsonb) AS recent_events,
  sessions.last_session,
  NOW() AS cache_time,
  observations.last_observation_at,
  COALESCE(session_counts.total_sessions, 0) AS total_sessions,
  COALESCE(part_counts.total_parts, 0) AS total_parts,
  COALESCE(part_counts.attention_count, 0) AS attention_count
FROM relevant_users ru
LEFT JOIN LATERAL (
  SELECT jsonb_agg(p_row) AS recent_parts
  FROM (
    SELECT
      p.id,
      COALESCE(p.name, p.placeholder, 'Unnamed Part') AS display_name,
      p.category,
      p.status,
      p.charge,
      p.needs_attention,
      p.last_active,
      NULLIF(p.data->>'emoji', '') AS emoji
    FROM public.parts_v2 p
    WHERE p.user_id = ru.user_id
    ORDER BY p.last_active DESC NULLS LAST
    LIMIT 6
  ) AS p_row
) recent_parts ON TRUE
LEFT JOIN LATERAL (
  SELECT jsonb_agg(pa_row) AS parts_needing_attention
  FROM (
    SELECT
      p.id,
      COALESCE(p.name, p.placeholder) AS display_name,
      CASE
        WHEN p.name IS NULL THEN 'needs_name'
        WHEN p.data->>'role' IS NULL THEN 'needs_role'
        WHEN p.category = 'unknown' THEN 'needs_category'
        ELSE 'needs_details'
      END AS next_step,
      p.updated_at
    FROM public.parts_v2 p
    WHERE p.user_id = ru.user_id
      AND p.needs_attention = TRUE
    ORDER BY p.updated_at DESC NULLS LAST
    LIMIT 6
  ) AS pa_row
) needs_attention ON TRUE
LEFT JOIN LATERAL (
  SELECT jsonb_agg(f_row) AS follow_ups
  FROM (
    SELECT
      o.id,
      o.content,
      o.type,
      o.created_at
    FROM public.observations o
    WHERE o.user_id = ru.user_id
      AND o.metadata->>'followUp' = 'true'
      AND o.metadata->>'completed' IS NULL
    ORDER BY o.created_at DESC
    LIMIT 10
  ) AS f_row
) followups ON TRUE
LEFT JOIN LATERAL (
  SELECT jsonb_agg(e_row) AS recent_events
  FROM (
    SELECT
      td.created_at,
      td.event_type,
      td.event_subtype,
      td.description,
      td.entities,
      td.metadata,
      td.source_id,
      td.source_table,
      td.session_id
    FROM public.timeline_display td
    WHERE td.user_id = ru.user_id
    ORDER BY td.created_at DESC
    LIMIT 15
  ) AS e_row
) events ON TRUE
LEFT JOIN LATERAL (
  SELECT to_jsonb(s_row) AS last_session
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
    WHERE s.user_id = ru.user_id
    ORDER BY s.started_at DESC NULLS LAST
    LIMIT 1
  ) AS s_row
) sessions ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*)::integer AS total_sessions
  FROM public.sessions_v2 s
  WHERE s.user_id = ru.user_id
) session_counts ON TRUE
LEFT JOIN LATERAL (
  SELECT
    MAX(o.created_at) AS last_observation_at
  FROM public.observations o
  WHERE o.user_id = ru.user_id
) observations ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::integer AS total_parts,
    COALESCE(SUM(CASE WHEN p.needs_attention THEN 1 ELSE 0 END), 0)::integer AS attention_count
  FROM public.parts_v2 p
  WHERE p.user_id = ru.user_id
) part_counts ON TRUE;

COMMENT ON MATERIALIZED VIEW public.user_context_cache IS 'Warm-start agent context snapshot including recent parts, events, and session summary.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_context_cache_user
  ON public.user_context_cache(user_id);

GRANT SELECT ON public.user_context_cache TO authenticated;
GRANT SELECT ON public.user_context_cache TO service_role;

-- -----------------------------------------------------------------------------
-- Refresh helper with concurrent fallback
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_user_context_cache()
RETURNS VOID AS $$
BEGIN
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_context_cache;
  EXCEPTION
    WHEN object_not_in_prerequisite_state OR feature_not_supported THEN
      REFRESH MATERIALIZED VIEW public.user_context_cache;
  END;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.refresh_user_context_cache() IS 'Refreshes user_context_cache matview with concurrent fallback for first-run scenarios.';

GRANT EXECUTE ON FUNCTION public.refresh_user_context_cache() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_user_context_cache() TO service_role;

-- NOTE: Scheduling for refresh cadence will be added in a later bead once agents consume the cache.
