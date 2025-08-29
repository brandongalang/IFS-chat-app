-- Migration for Check-ins Feature
-- Migration: 007_check_ins
-- Created: 2025-08-28

-- Check-ins table
CREATE TABLE check_ins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('morning', 'evening')),
    check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
    mood INTEGER CHECK (mood >= 1 AND mood <= 5),
    energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 5),
    intention TEXT,
    reflection TEXT,
    gratitude TEXT,
    parts_data JSONB,
    somatic_markers TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, check_in_date, type)
);

-- Indexes
CREATE INDEX idx_check_ins_user_id ON check_ins(user_id);
CREATE INDEX idx_check_ins_user_id_date ON check_ins(user_id, check_in_date);

-- RLS
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own check_ins"
    ON check_ins FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own check_ins"
    ON check_ins FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own check_ins"
    ON check_ins FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own check_ins"
    ON check_ins FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_check_ins_updated_at BEFORE UPDATE ON check_ins FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comment on table
COMMENT ON TABLE check_ins IS 'Stores daily check-in data from users, including mood, intentions, and identified parts.';
COMMENT ON COLUMN check_ins.somatic_markers IS 'Physical sensations noted during the check-in.';
COMMENT ON COLUMN check_ins.parts_data IS 'JSONB blob to store details about parts that were present during the check-in.';
COMMENT ON COLUMN check_ins.type IS 'Type of check-in: morning or evening.';
