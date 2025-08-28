-- User Memory System Schema
-- Migration: 006_user_memory
-- Created: 2025-08-28

-- Table: user_memory_snapshots
CREATE TABLE IF NOT EXISTS user_memory_snapshots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version integer NOT NULL,
  patch jsonb NOT NULL,
  is_full_snapshot boolean NOT NULL DEFAULT FALSE,
  full_snapshot_content jsonb NULL,
  source_description text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Make sure version is unique per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_memory_snapshots_user_version ON user_memory_snapshots(user_id, version);

-- Add other useful indexes
CREATE INDEX IF NOT EXISTS idx_user_memory_snapshots_user_id ON user_memory_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_snapshots_user_created_at ON user_memory_snapshots(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_memory_snapshots_checkpoints ON user_memory_snapshots(user_id, created_at DESC) WHERE is_full_snapshot = TRUE;


-- RLS
ALTER TABLE user_memory_snapshots ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own memory snapshots"
  ON user_memory_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memory snapshots"
  ON user_memory_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memory snapshots"
  ON user_memory_snapshots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own memory snapshots"
  ON user_memory_snapshots FOR DELETE
  USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE user_memory_snapshots IS 'Stores the history of a user''s memory as differential snapshots (JSON Patches).';
COMMENT ON COLUMN user_memory_snapshots.version IS 'A sequential version number for each user''s memory history.';
COMMENT ON COLUMN user_memory_snapshots.patch IS 'A JSON Patch (RFC 6902) object describing the change from the previous version.';
COMMENT ON COLUMN user_memory_snapshots.is_full_snapshot IS 'If TRUE, this row is a checkpoint containing the full memory state.';
COMMENT ON COLUMN user_memory_snapshots.full_snapshot_content IS 'The full memory state, only present for checkpoints (when is_full_snapshot is TRUE).';
