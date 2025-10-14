-- PRD Core Schema Foundations
-- Migration: 111_prd_core_tables
-- Description: Introduce PRD-compliant tables (observations, sessions_v2, parts_v2, part_relationships_v2, timeline_events)
-- Notes:
--   * Existing tables are left in place; "_v2" tables will replace them after backfill and verification.
--   * Follow-up migrations will handle renames, data migration, and removal of legacy structures.

-- Ensure helper function exists for updated_at triggers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;

-- =============================================================
-- Parts V2 (PRD-compliant structure)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.parts_v2 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  name TEXT,
  placeholder TEXT,

  category TEXT DEFAULT 'unknown'
    CHECK (category IN ('manager', 'firefighter', 'exile', 'unknown')),
  status TEXT DEFAULT 'emerging'
    CHECK (status IN ('emerging', 'acknowledged', 'active', 'integrated')),
  charge TEXT DEFAULT 'neutral'
    CHECK (charge IN ('positive', 'negative', 'neutral')),

  data JSONB DEFAULT '{}'::jsonb,
  needs_attention BOOLEAN DEFAULT FALSE,
  confidence DOUBLE PRECISION DEFAULT 0.0
    CHECK (confidence >= 0.0 AND confidence <= 1.0),
  evidence_count INTEGER DEFAULT 0,

  first_noticed TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector(
      'english',
      COALESCE(name, '') || ' ' ||
      COALESCE(placeholder, '') || ' ' ||
      COALESCE(data->>'role', '')
    )
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_parts_v2_user
  ON public.parts_v2(user_id);

CREATE INDEX IF NOT EXISTS idx_parts_v2_needs_attention
  ON public.parts_v2(user_id, needs_attention)
  WHERE needs_attention = TRUE;

CREATE INDEX IF NOT EXISTS idx_parts_v2_search
  ON public.parts_v2 USING GIN(search_vector);

COMMENT ON TABLE public.parts_v2 IS 'PRD-compliant parts table supporting placeholders, gradual discovery metadata, and search indexing.';

ALTER TABLE public.parts_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS parts_v2_select_own
  ON public.parts_v2
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS parts_v2_insert_own
  ON public.parts_v2
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS parts_v2_update_own
  ON public.parts_v2
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS parts_v2_delete_own
  ON public.parts_v2
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_parts_v2_updated_at
  BEFORE UPDATE ON public.parts_v2
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================
-- Sessions V2 (structured session tracking)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.sessions_v2 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  type TEXT DEFAULT 'therapy'
    CHECK (type IN ('therapy', 'check_in', 'exploration')),

  observations UUID[] DEFAULT '{}'::uuid[],
  parts_present UUID[] DEFAULT '{}'::uuid[],

  summary TEXT,
  key_insights TEXT[] DEFAULT '{}'::text[],
  breakthroughs TEXT[] DEFAULT '{}'::text[],
  resistance_notes TEXT[] DEFAULT '{}'::text[],
  homework TEXT[] DEFAULT '{}'::text[],
  next_session TEXT[] DEFAULT '{}'::text[],

  metadata JSONB DEFAULT '{}'::jsonb,

  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_v2_user
  ON public.sessions_v2(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_v2_active
  ON public.sessions_v2(user_id)
  WHERE ended_at IS NULL;

COMMENT ON TABLE public.sessions_v2 IS 'Structured session log supporting PRD agent context and summaries.';

ALTER TABLE public.sessions_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS sessions_v2_select_own
  ON public.sessions_v2
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS sessions_v2_insert_own
  ON public.sessions_v2
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS sessions_v2_update_own
  ON public.sessions_v2
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS sessions_v2_delete_own
  ON public.sessions_v2
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_sessions_v2_updated_at
  BEFORE UPDATE ON public.sessions_v2
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================
-- Observations (raw therapeutic notes)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.observations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions_v2(id) ON DELETE SET NULL,

  type TEXT NOT NULL
    CHECK (type IN ('part_behavior', 'resistance', 'breakthrough', 'somatic', 'pattern', 'note')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  entities UUID[] DEFAULT '{}'::uuid[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', content)
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_observations_user_type
  ON public.observations(user_id, type);

CREATE INDEX IF NOT EXISTS idx_observations_session
  ON public.observations(session_id);

CREATE INDEX IF NOT EXISTS idx_observations_search
  ON public.observations USING GIN(search_vector);

CREATE INDEX IF NOT EXISTS idx_observations_entities
  ON public.observations USING GIN(entities);

CREATE INDEX IF NOT EXISTS idx_observations_follow_up
  ON public.observations(user_id, created_at)
  WHERE metadata->>'followUp' = 'true';

COMMENT ON TABLE public.observations IS 'Raw therapeutic observations captured during sessions for PRD data layer.';

ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS observations_select_own
  ON public.observations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS observations_insert_own
  ON public.observations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS observations_update_own
  ON public.observations
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS observations_delete_own
  ON public.observations
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_observations_updated_at
  BEFORE UPDATE ON public.observations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================
-- Part Relationships V2 (explicit pairing)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.part_relationships_v2 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  part_a_id UUID NOT NULL REFERENCES public.parts_v2(id) ON DELETE CASCADE,
  part_b_id UUID NOT NULL REFERENCES public.parts_v2(id) ON DELETE CASCADE,
  type TEXT NOT NULL
    CHECK (type IN ('protects', 'conflicts', 'supports', 'triggers', 'soothes')),
  strength DOUBLE PRECISION DEFAULT 0.5
    CHECK (strength >= 0.0 AND strength <= 1.0),
  context TEXT,
  observations TEXT[] DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(part_a_id, part_b_id, type)
);

CREATE INDEX IF NOT EXISTS idx_part_relationships_v2_user
  ON public.part_relationships_v2(user_id);

CREATE INDEX IF NOT EXISTS idx_part_relationships_v2_part_a
  ON public.part_relationships_v2(part_a_id);

CREATE INDEX IF NOT EXISTS idx_part_relationships_v2_part_b
  ON public.part_relationships_v2(part_b_id);

COMMENT ON TABLE public.part_relationships_v2 IS 'Explicit PRD relationship mapping between two parts with typed context.';

ALTER TABLE public.part_relationships_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS part_relationships_v2_select_own
  ON public.part_relationships_v2
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS part_relationships_v2_insert_own
  ON public.part_relationships_v2
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS part_relationships_v2_update_own
  ON public.part_relationships_v2
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS part_relationships_v2_delete_own
  ON public.part_relationships_v2
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_part_relationships_v2_updated_at
  BEFORE UPDATE ON public.part_relationships_v2
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================
-- Timeline Events (auto-generated milestones)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.timeline_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions_v2(id) ON DELETE SET NULL,
  type TEXT NOT NULL
    CHECK (type IN ('part_emerged', 'breakthrough', 'integration', 'relationship_discovered')),
  description TEXT,
  entities UUID[] DEFAULT '{}'::uuid[],
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_user
  ON public.timeline_events(user_id, created_at DESC);

COMMENT ON TABLE public.timeline_events IS 'Auto-generated timeline milestones for PRD UI and analytics.';

ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS timeline_events_select_own
  ON public.timeline_events
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS timeline_events_insert_own
  ON public.timeline_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS timeline_events_update_own
  ON public.timeline_events
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS timeline_events_delete_own
  ON public.timeline_events
  FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================
-- Migration Guidance (for future beads)
-- =============================================================
-- * Backfill existing parts data into parts_v2, ensuring placeholder, charge, and data JSON are populated.
-- * Translate sessions JSON payloads into sessions_v2 structured arrays.
-- * When ready, migrate part_relationships to the explicit schema and swap references.
-- * Observations and timeline_events backfill can begin once new ingestion pipelines are in place.
