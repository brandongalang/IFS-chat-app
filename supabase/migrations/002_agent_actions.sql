-- Agent Actions Table for Rollback System
-- Tracks all agent mutations with semantic context for easy rollback

CREATE TABLE agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  action_type text NOT NULL, -- 'create_part', 'update_part_confidence', 'update_part_category', etc.
  target_table text NOT NULL, -- 'parts', 'sessions', 'part_relationships'
  target_id uuid NOT NULL,
  old_state jsonb, -- NULL for creates, previous state for updates
  new_state jsonb, -- New state after change
  metadata jsonb DEFAULT '{}', -- Rich context: part name, change description, session_id, etc.
  created_at timestamptz DEFAULT now(),
  created_by text DEFAULT 'agent', -- 'agent', 'user', 'system'
  rolled_back boolean DEFAULT false,
  rollback_reason text NULL,
  rollback_at timestamptz NULL
);

-- Indexes for efficient querying
CREATE INDEX idx_agent_actions_user_id ON agent_actions(user_id);
CREATE INDEX idx_agent_actions_target ON agent_actions(target_table, target_id);
CREATE INDEX idx_agent_actions_created_at ON agent_actions(user_id, created_at DESC);
CREATE INDEX idx_agent_actions_type ON agent_actions(user_id, action_type, created_at DESC);
CREATE INDEX idx_agent_actions_rollback ON agent_actions(user_id, rolled_back, created_at DESC);

-- Partial index for active (non-rolled-back) actions
CREATE INDEX idx_agent_actions_active ON agent_actions(user_id, created_at DESC) 
WHERE rolled_back = false;

-- GIN index for metadata searches (enables semantic queries)
CREATE INDEX idx_agent_actions_metadata ON agent_actions USING gin(metadata);

COMMENT ON TABLE agent_actions IS 'Tracks all agent database mutations with rich context for semantic rollback capabilities';
COMMENT ON COLUMN agent_actions.metadata IS 'Rich context like: {"partName": "Inner Critic", "changeDescription": "increased confidence from 0.7 to 0.8", "sessionId": "uuid", "evidenceAdded": true}';