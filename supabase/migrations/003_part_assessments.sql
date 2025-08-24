-- Part assessments ledger for explicit confidence updates
CREATE TABLE IF NOT EXISTS part_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  part_id uuid NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  source text NOT NULL,              -- 'agent_llm' | 'human'
  score numeric NOT NULL CHECK (score >= 0 AND score <= 1),
  rationale text,
  evidence_refs jsonb DEFAULT '[]',
  model text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate application on retries
CREATE UNIQUE INDEX IF NOT EXISTS uq_part_assessments_idem
  ON part_assessments (user_id, part_id, COALESCE(idempotency_key, ''));

