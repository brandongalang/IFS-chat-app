-- Migration: 013_message_feedback (renamed from 008 to ensure unique version)
-- Created: 2025-08-29

-- Create the message_feedback table
CREATE TABLE message_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating TEXT NOT NULL CHECK (rating IN ('thumb_up', 'thumb_down')),
    explanation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_message_feedback_session_id ON message_feedback(session_id);
CREATE INDEX idx_message_feedback_user_id ON message_feedback(user_id);
CREATE INDEX idx_message_feedback_message_id ON message_feedback(message_id);

-- Add comments for table and columns
COMMENT ON TABLE message_feedback IS 'Stores user feedback for AI-generated messages.';
COMMENT ON COLUMN message_feedback.rating IS 'User rating for the message (thumb_up or thumb_down).';
COMMENT ON COLUMN message_feedback.explanation IS 'Optional user-provided text explaining their rating.';

-- Enable Row Level Security (RLS)
ALTER TABLE message_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for message_feedback table
CREATE POLICY "Users can view their own feedback"
    ON message_feedback FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback"
    ON message_feedback FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback"
    ON message_feedback FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feedback"
    ON message_feedback FOR DELETE
    USING (auth.uid() = user_id);
