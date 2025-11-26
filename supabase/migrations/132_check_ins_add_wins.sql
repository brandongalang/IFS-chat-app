-- Migration: 132_check_ins_add_wins
-- Description: Add wins column to check_ins table for tracking daily accomplishments
-- This supports the refined check-in experience where users capture positive moments

-- Add wins column for evening check-ins
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS wins TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN check_ins.wins IS 'User-captured wins or accomplishments from the day (evening check-ins only). Used by agent for positive reinforcement.';

-- Create index for full-text search on wins (matches existing gratitude pattern)
CREATE INDEX IF NOT EXISTS idx_check_ins_wins_search ON check_ins USING gin(to_tsvector('english', COALESCE(wins, '')));
