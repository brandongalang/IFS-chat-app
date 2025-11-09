-- Unified Inbox Items Table
-- Migration: 130_unified_inbox_items
-- Purpose: Consolidate insights and inbox_observations into single unified table
-- This replaces the separate insights + inbox_observations + inbox_items_view approach

-- ============================================================================
-- Create unified inbox_items table supporting all 6 output types
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inbox_items (
  -- Identity & Classification
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Item Type and Status
  type text NOT NULL CHECK (type IN (
    'session_summary',   -- Key themes from recent session
    'nudge',            -- Gentle hypothesis about parts/dynamics
    'follow_up',        -- Integration prompt after breakthrough
    'observation',      -- Therapy-grounded inference with evidence
    'question',         -- Curious probe to explore hypothesis
    'pattern'           -- Synthesized insight across multiple evidence types
  )),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',          -- Ready for display
    'revealed',         -- User has seen it
    'actioned',         -- User took action on it
    'dismissed'         -- User dismissed it
  )),
  
  -- Content and Metadata
  content jsonb NOT NULL DEFAULT '{}'::jsonb, -- {title, summary, body, inference}
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, -- {kind, confidence, semantic_hash, related_part_ids, etc.}
  
  -- Evidence References
  evidence jsonb DEFAULT '[]'::jsonb, -- [{type, id, context}, ...] for observations/patterns
  related_part_ids uuid[] DEFAULT '{}'::uuid[], -- Parts involved
  source_session_ids uuid[] DEFAULT '{}'::uuid[], -- Sessions that informed this
  
  -- Lifecycle & Ratings
  rating jsonb,  -- {scheme: "quartile-v1", value: 1-4, label: "..."}
  feedback text,
  
  -- Timestamps with lifecycle tracking
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revealed_at timestamptz,
  actioned_at timestamptz,
  dismissed_at timestamptz,
  
  -- Processing tracking
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  
  -- Deduplication
  semantic_hash text,
  confidence double precision, -- For observations/patterns
  
  -- Observation-specific fields (for backward compatibility)
  timeframe_start timestamptz,
  timeframe_end timestamptz,
  
  -- Provenance
  source_type text CHECK (source_type IN ('insight_generated', 'observation_generated', 'part_follow_up', 'migrated')),
  source_table text, -- 'insights' or 'inbox_observations' for migrated records
  source_id uuid -- Original ID from insights or inbox_observations table
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_inbox_items_user
  ON public.inbox_items(user_id);

CREATE INDEX IF NOT EXISTS idx_inbox_items_user_status
  ON public.inbox_items(user_id, status);

CREATE INDEX IF NOT EXISTS idx_inbox_items_user_status_created
  ON public.inbox_items(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbox_items_user_created
  ON public.inbox_items(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbox_items_user_type
  ON public.inbox_items(user_id, type, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inbox_items_user_hash
  ON public.inbox_items(user_id, semantic_hash)
  WHERE semantic_hash IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_inbox_items_updated_at
  BEFORE UPDATE ON public.inbox_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE public.inbox_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_items" ON public.inbox_items
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_items" ON public.inbox_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_items" ON public.inbox_items
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_items" ON public.inbox_items
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "service_role_manage_items" ON public.inbox_items
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

GRANT SELECT ON public.inbox_items TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.inbox_items TO authenticated;
GRANT ALL ON public.inbox_items TO service_role;

COMMENT ON TABLE public.inbox_items IS 'Unified inbox items combining insights, observations, and generated follow-ups. Single source of truth for all inbox content.';
COMMENT ON COLUMN public.inbox_items.type IS '6 types: session_summary, nudge, follow_up, observation, question, pattern';
COMMENT ON COLUMN public.inbox_items.status IS 'pending → revealed → actioned/dismissed';
COMMENT ON COLUMN public.inbox_items.evidence IS 'JSON array of {type, id, context} for observations and patterns';

-- ============================================================================
-- Migrate insights data to inbox_items
-- ============================================================================

INSERT INTO public.inbox_items (
  id, user_id, type, status, content, metadata,
  evidence, related_part_ids, source_session_ids,
  rating, feedback, revealed_at, actioned_at, processed, processed_at,
  created_at, updated_at, semantic_hash, source_type, source_table, source_id
)
SELECT
  i.id,
  i.user_id,
  i.type::text, -- session_summary, nudge, follow_up, observation
  CASE 
    WHEN i.status = 'actioned' THEN 'actioned'
    WHEN i.status = 'revealed' THEN 'revealed'
    ELSE 'pending'
  END,
  jsonb_build_object(
    'title', (i.content->>'title'),
    'summary', (i.content->>'body'),
    'body', (i.content->>'body')
  ),
  COALESCE(i.meta, '{}'::jsonb)
    || jsonb_build_object(
      'insight_type', i.type,
      'rating', i.rating,
      'migrated_from', 'insights'
    ),
  '[]'::jsonb, -- No evidence for migrated insights
  '{}'::uuid[], -- No related parts tracked in insights
  (COALESCE(i.content->'sourceSessionIds', '[]'::jsonb))::uuid[], -- Source sessions from content
  i.rating,
  i.feedback,
  i.revealed_at,
  i.actioned_at,
  i.processed,
  i.processed_at,
  i.created_at,
  i.updated_at,
  NULL, -- No semantic_hash for insights
  'insight_generated',
  'insights',
  i.id
FROM public.insights i
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Migrate inbox_observations to inbox_items
-- ============================================================================

INSERT INTO public.inbox_items (
  id, user_id, type, status, content, metadata,
  evidence, related_part_ids, semantic_hash, confidence,
  timeframe_start, timeframe_end, source_type, source_table, source_id,
  created_at, updated_at
)
SELECT
  o.id,
  o.user_id,
  'observation'::text,
  o.status,
  o.content,
  o.metadata,
  '[]'::jsonb, -- Evidence will be populated by agent during generation
  o.related_part_ids,
  o.semantic_hash,
  o.confidence,
  o.timeframe_start,
  o.timeframe_end,
  'observation_generated',
  'inbox_observations',
  o.id,
  o.created_at,
  o.updated_at
FROM public.inbox_observations o
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Create new unified view for API consumption
-- ============================================================================

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
  i.dismissed_at
FROM public.inbox_items i
WHERE i.status IN ('pending', 'revealed')
ORDER BY i.created_at DESC;

GRANT SELECT ON public.inbox_items_view TO authenticated;
GRANT SELECT ON public.inbox_items_view TO service_role;

COMMENT ON VIEW public.inbox_items_view IS 'Unified inbox feed containing all inbox items (insights, observations, follow-ups). Single source of truth.';

-- ============================================================================
-- Cleanup: Archive old tables (don't drop to preserve historical data)
-- ============================================================================

-- Rename old tables to archive_ prefix for reference but don't drop
ALTER TABLE IF EXISTS public.insights RENAME TO insights_legacy;
ALTER TABLE IF EXISTS public.inbox_observations RENAME TO inbox_observations_legacy;

-- Drop old observation_events and jobs tables (data preserved in archive)
DROP TABLE IF EXISTS public.observation_events CASCADE;
DROP TABLE IF EXISTS public.inbox_job_runs CASCADE;

COMMENT ON TABLE public.insights_legacy IS 'ARCHIVED: Original insights table. Data migrated to inbox_items. Kept for historical reference.';
COMMENT ON TABLE public.inbox_observations_legacy IS 'ARCHIVED: Original inbox_observations table. Data migrated to inbox_items. Kept for historical reference.';
