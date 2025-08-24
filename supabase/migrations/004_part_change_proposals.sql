-- Part change proposals table: decouple planning from mutation
CREATE TABLE IF NOT EXISTS part_change_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  type text NOT NULL CHECK (type IN ('split','merge','reclassify')),
  payload jsonb NOT NULL DEFAULT '{}',  -- contains suggested operations, children, evidence mappings, canonicalName, etc.
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','executed')),
  rationale text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by text,
  executed_at timestamptz,
  executed_by text
);

CREATE INDEX IF NOT EXISTS idx_part_change_proposals_user ON part_change_proposals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_part_change_proposals_status ON part_change_proposals(user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_part_change_proposals_idem
  ON part_change_proposals (user_id, COALESCE(idempotency_key, ''));

