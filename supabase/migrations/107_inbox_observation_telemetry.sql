-- Inbox observation telemetry storage

CREATE TABLE inbox_observation_telemetry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tool TEXT NOT NULL,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}',
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE inbox_observation_telemetry ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_inbox_observation_telemetry_user_created_at
    ON inbox_observation_telemetry (user_id, created_at DESC);
