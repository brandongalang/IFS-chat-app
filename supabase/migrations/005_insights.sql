-- Insights MVP schema
-- Migration: 005_insights
-- Created: 2025-08-28

-- Table: insights
CREATE TABLE IF NOT EXISTS insights (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('session_summary','nudge','follow_up','observation')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','revealed','actioned')),
  content jsonb NOT NULL,   -- e.g., { "title": "...", "body": "...", "highlights": [], "sourceSessionIds": [] }
  rating jsonb NULL,        -- e.g., { "scheme": "quartile-v1", "value": 1, "label": "low resonance" }
  feedback text NULL,
  revealed_at timestamptz NULL,
  actioned_at timestamptz NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb, -- provenance/generator/jit flag/etc.
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_insights_user ON insights(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_user_status ON insights(user_id, status);
CREATE INDEX IF NOT EXISTS idx_insights_user_status_created ON insights(user_id, status, created_at DESC);

-- updated_at trigger (reuse existing function from 001_initial_schema.sql)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_insights_updated_at'
  ) THEN
    CREATE TRIGGER update_insights_updated_at
      BEFORE UPDATE ON insights
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- RLS
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

-- Policies (mirror style of other tables)
CREATE POLICY "Users can view own insights"
  ON insights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own insights"
  ON insights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own insights"
  ON insights FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own insights"
  ON insights FOR DELETE
  USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE insights IS 'User insights cards (pending → revealed → actioned). Content and rating are JSON.';
COMMENT ON COLUMN insights.type IS 'session_summary | nudge | follow_up | observation';
COMMENT ON COLUMN insights.status IS 'pending | revealed | actioned';
COMMENT ON COLUMN insights.content IS 'Structured card payload (title, body, highlights, sourceSessionIds)';
COMMENT ON COLUMN insights.rating IS 'Flexible rating JSON (e.g., quartile scheme)';
COMMENT ON COLUMN insights.meta IS 'Provenance, generator info, jit flag, slot hints';

