-- IFS Therapy Companion Database Schema
-- Migration: 001_initial_schema
-- Created: 2025-01-21

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables if they exist (for development)
DROP TABLE IF EXISTS part_relationships CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS parts CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    settings JSONB DEFAULT '{
        "timezone": "UTC",
        "privacyMode": false,
        "aiDepth": "medium",
        "notifications": {
            "partEmergence": true,
            "sessionReminders": true,
            "weeklyInsights": true
        }
    }'::jsonb,
    stats JSONB DEFAULT '{
        "totalParts": 0,
        "totalSessions": 0,
        "streakDays": 0,
        "longestSession": 0,
        "averageSessionLength": 0
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Parts table
CREATE TABLE parts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'emerging' CHECK (status IN ('emerging', 'acknowledged', 'active', 'integrated')),
    category TEXT DEFAULT 'unknown' CHECK (category IN ('manager', 'firefighter', 'exile', 'unknown')),
    age INTEGER,
    role TEXT,
    triggers TEXT[] DEFAULT '{}',
    emotions TEXT[] DEFAULT '{}',
    beliefs TEXT[] DEFAULT '{}',
    somatic_markers TEXT[] DEFAULT '{}',
    confidence FLOAT DEFAULT 0.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    evidence_count INTEGER DEFAULT 0,
    recent_evidence JSONB DEFAULT '[]'::jsonb,
    story JSONB DEFAULT '{
        "origin": null,
        "currentState": null,
        "purpose": null,
        "evolution": []
    }'::jsonb,
    relationships JSONB DEFAULT '{}'::jsonb,
    visualization JSONB DEFAULT '{
        "emoji": "🤗",
        "color": "#6B7280",
        "energyLevel": 0.5
    }'::jsonb,
    first_noticed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, name)
);

-- Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- in seconds
    messages JSONB DEFAULT '[]'::jsonb,
    summary TEXT,
    parts_involved JSONB DEFAULT '{}'::jsonb,
    new_parts UUID[] DEFAULT '{}',
    breakthroughs TEXT[] DEFAULT '{}',
    emotional_arc JSONB DEFAULT '{
        "start": {"valence": 0.5, "arousal": 0.5},
        "peak": {"valence": 0.5, "arousal": 0.5},
        "end": {"valence": 0.5, "arousal": 0.5}
    }'::jsonb,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Part Relationships table
CREATE TABLE part_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parts JSONB NOT NULL, -- array of part IDs involved in relationship
    type TEXT NOT NULL CHECK (type IN ('polarized', 'protector-exile', 'allied')),
    description TEXT,
    issue TEXT,
    common_ground TEXT,
    dynamics JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'healing', 'resolved')),
    polarization_level FLOAT DEFAULT 0.5 CHECK (polarization_level >= 0.0 AND polarization_level <= 1.0),
    last_addressed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_parts_user_id ON parts(user_id);
CREATE INDEX idx_parts_user_status ON parts(user_id, status);
CREATE INDEX idx_parts_user_last_active ON parts(user_id, last_active DESC);
CREATE INDEX idx_parts_confidence ON parts(confidence DESC);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_user_start_time ON sessions(user_id, start_time DESC);
CREATE INDEX idx_sessions_processed ON sessions(processed);
CREATE INDEX idx_part_relationships_user_id ON part_relationships(user_id);
CREATE INDEX idx_part_relationships_parts ON part_relationships USING GIN(parts);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_parts_updated_at BEFORE UPDATE ON parts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_part_relationships_updated_at BEFORE UPDATE ON part_relationships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_relationships ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile" 
    ON users FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
    ON users FOR UPDATE 
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
    ON users FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- RLS Policies for parts table
CREATE POLICY "Users can view own parts" 
    ON parts FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own parts" 
    ON parts FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own parts" 
    ON parts FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own parts" 
    ON parts FOR DELETE 
    USING (auth.uid() = user_id);

-- RLS Policies for sessions table
CREATE POLICY "Users can view own sessions" 
    ON sessions FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" 
    ON sessions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" 
    ON sessions FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" 
    ON sessions FOR DELETE 
    USING (auth.uid() = user_id);

-- RLS Policies for part_relationships table
CREATE POLICY "Users can view own part relationships" 
    ON part_relationships FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own part relationships" 
    ON part_relationships FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own part relationships" 
    ON part_relationships FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own part relationships" 
    ON part_relationships FOR DELETE 
    USING (auth.uid() = user_id);

-- Create functions for common operations

-- Function to update part confidence
CREATE OR REPLACE FUNCTION update_part_confidence(
    part_id UUID,
    confidence_delta FLOAT DEFAULT 0.05
)
RETURNS FLOAT AS $$
DECLARE
    new_confidence FLOAT;
BEGIN
    UPDATE parts 
    SET confidence = LEAST(1.0, GREATEST(0.0, confidence + confidence_delta)),
        updated_at = NOW()
    WHERE id = part_id AND user_id = auth.uid()
    RETURNING confidence INTO new_confidence;
    
    RETURN new_confidence;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add evidence to a part
CREATE OR REPLACE FUNCTION add_part_evidence(
    part_id UUID,
    evidence_item JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
    current_evidence JSONB;
    new_evidence JSONB;
BEGIN
    -- Get current evidence
    SELECT recent_evidence INTO current_evidence
    FROM parts 
    WHERE id = part_id AND user_id = auth.uid();
    
    -- Add new evidence and keep only last 10 items
    new_evidence := (current_evidence || jsonb_build_array(evidence_item))[-10:];
    
    -- Update the part
    UPDATE parts 
    SET recent_evidence = new_evidence,
        evidence_count = evidence_count + 1,
        last_active = NOW(),
        updated_at = NOW()
    WHERE id = part_id AND user_id = auth.uid();
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user stats
CREATE OR REPLACE FUNCTION get_user_stats(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    part_count INTEGER;
    session_count INTEGER;
    avg_session_length FLOAT;
    longest_session INTEGER;
    stats JSONB;
BEGIN
    -- Count parts
    SELECT COUNT(*) INTO part_count
    FROM parts 
    WHERE user_id = user_uuid;
    
    -- Count sessions and calculate averages
    SELECT 
        COUNT(*),
        COALESCE(AVG(duration), 0),
        COALESCE(MAX(duration), 0)
    INTO session_count, avg_session_length, longest_session
    FROM sessions 
    WHERE user_id = user_uuid AND end_time IS NOT NULL;
    
    -- Build stats object
    stats := jsonb_build_object(
        'totalParts', part_count,
        'totalSessions', session_count,
        'averageSessionLength', avg_session_length,
        'longestSession', longest_session,
        'lastUpdated', extract(epoch from NOW())
    );
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for table documentation
COMMENT ON TABLE users IS 'User profiles with settings and statistics';
COMMENT ON TABLE parts IS 'Internal parts discovered through IFS therapy conversations';
COMMENT ON TABLE sessions IS 'Therapy conversation sessions with message history';
COMMENT ON TABLE part_relationships IS 'Relationships and dynamics between different parts';

COMMENT ON COLUMN parts.status IS 'Part development stage: emerging -> acknowledged -> active -> integrated';
COMMENT ON COLUMN parts.category IS 'IFS part type: manager (proactive), firefighter (reactive), exile (wounded)';
COMMENT ON COLUMN parts.confidence IS 'AI confidence in part existence (0.0-1.0)';
COMMENT ON COLUMN parts.recent_evidence IS 'Last 10 pieces of evidence supporting this part';
COMMENT ON COLUMN sessions.processed IS 'Whether background AI processing has been completed';
COMMENT ON COLUMN part_relationships.polarization_level IS 'How conflicted the parts are (0=harmony, 1=high conflict)';