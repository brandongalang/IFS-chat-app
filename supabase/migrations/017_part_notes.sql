-- Clarification notes for user parts
CREATE TABLE IF NOT EXISTS part_notes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_id uuid NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_part_notes_part_id ON part_notes(part_id);

ALTER TABLE part_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can view notes for own parts" ON part_notes;
  DROP POLICY IF EXISTS "Users can add notes for own parts" ON part_notes;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE POLICY "Users can view notes for own parts"
  ON part_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM parts
      WHERE parts.id = part_notes.part_id
        AND parts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add notes for own parts"
  ON part_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM parts
      WHERE parts.id = part_notes.part_id
        AND parts.user_id = auth.uid()
    )
  );
