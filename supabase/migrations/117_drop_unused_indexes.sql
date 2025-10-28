-- Drop Unused Indexes
-- Migration: 117_drop_unused_indexes
-- Purpose: Remove indexes that have never been used (INFO level warnings)
-- Impact: Reduces storage overhead and improves write performance
-- Note: Conservative approach - only drops indexes that are clearly unused

-- =============================================================
-- Safety check: Verify this is running in non-production environment
-- Set confirm_unused_indexes_drop = true to proceed, otherwise this migration will be a no-op
-- =============================================================

DO $$
DECLARE
    confirm_unused_indexes_drop BOOLEAN := false; -- SET TO TRUE TO PROCEED WITH INDEX DROPS
    dropped_count integer := 0;
    skipped_count integer := 0;
BEGIN
    IF NOT confirm_unused_indexes_drop THEN
        RAISE NOTICE 'SAFETY: Skipping index drops. Set confirm_unused_indexes_drop = true in this migration to proceed.';
        RETURN;
    END IF;
    
    RAISE NOTICE 'PROCEEDING: Dropping unused indexes...';
    
    -- =============================================================
    -- Events table indexes (7 unused indexes identified)
    -- =============================================================
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'events' AND indexname = 'idx_events_user_ts') THEN
        DROP INDEX IF EXISTS idx_events_user_ts;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_events_user_ts (events table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'events' AND indexname = 'idx_events_entity_ts') THEN
        DROP INDEX IF EXISTS idx_events_entity_ts;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_events_entity_ts (events table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'events' AND indexname = 'idx_events_transaction_id') THEN
        DROP INDEX IF EXISTS idx_events_transaction_id;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_events_transaction_id (events table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'events' AND indexname = 'idx_events_tool_call_id') THEN
        DROP INDEX IF EXISTS idx_events_tool_call_id;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_events_tool_call_id (events table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'events' AND indexname = 'idx_events_agent_action_id') THEN
        DROP INDEX IF EXISTS idx_events_agent_action_id;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_events_agent_action_id (events table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'events' AND indexname = 'idx_events_type_ts') THEN
        DROP INDEX IF EXISTS idx_events_type_ts;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_events_type_ts (events table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'events' AND indexname = 'idx_events_evidence_gin') THEN
        DROP INDEX IF EXISTS idx_events_evidence_gin;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_events_evidence_gin (events table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'events' AND indexname = 'idx_events_lint_gin') THEN
        DROP INDEX IF EXISTS idx_events_lint_gin;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_events_lint_gin (events table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    -- =============================================================
    -- Other clearly unused indexes
    -- =============================================================
    
    -- Idempotency records
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'idempotency_records' AND indexname = 'idx_idem_expires_at') THEN
        DROP INDEX IF EXISTS idx_idem_expires_at;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_idem_expires_at (idempotency_records table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    -- Inbox message events
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'inbox_message_events' AND indexname = 'inbox_message_events_user_subject_idx') THEN
        DROP INDEX IF EXISTS inbox_message_events_user_subject_idx;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped inbox_message_events_user_subject_idx';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    -- Insights table indexes (conservative selection)
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'insights' AND indexname = 'idx_insights_user') THEN
        DROP INDEX IF EXISTS idx_insights_user;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_insights_user (insights table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'insights' AND indexname = 'idx_insights_user_status') THEN
        DROP INDEX IF EXISTS idx_insights_user_status;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_insights_user_status (insights table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    -- Parts table indexes (conservative selection)
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'parts' AND indexname = 'idx_parts_user_id') THEN
        DROP INDEX IF EXISTS idx_parts_user_id;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_parts_user_id (parts table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'parts' AND indexname = 'idx_parts_user_status') THEN
        DROP INDEX IF EXISTS idx_parts_user_status;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_parts_user_status (parts table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'parts' AND indexname = 'idx_parts_confidence') THEN
        DROP INDEX IF EXISTS idx_parts_confidence;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_parts_confidence (parts table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    -- Sessions table indexes
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'sessions' AND indexname = 'idx_sessions_user_id') THEN
        DROP INDEX IF EXISTS idx_sessions_user_id;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_sessions_user_id (sessions table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'sessions' AND indexname = 'idx_sessions_processed') THEN
        DROP INDEX IF EXISTS idx_sessions_processed;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_sessions_processed (sessions table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    -- Part relationships
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'part_relationships' AND indexname = 'idx_part_relationships_parts') THEN
        DROP INDEX IF EXISTS idx_part_relationships_parts;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_part_relationships_parts (part_relationships table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    -- Part change proposals
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'part_change_proposals' AND indexname = 'idx_part_change_proposals_user') THEN
        DROP INDEX IF EXISTS idx_part_change_proposals_user;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_part_change_proposals_user (part_change_proposals table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'part_change_proposals' AND indexname = 'idx_part_change_proposals_status') THEN
        DROP INDEX IF EXISTS idx_part_change_proposals_status;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_part_change_proposals_status (part_change_proposals table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    -- Check ins
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'check_ins' AND indexname = 'idx_check_ins_user_id') THEN
        DROP INDEX IF EXISTS idx_check_ins_user_id;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_check_ins_user_id (check_ins table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    -- User onboarding
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'user_onboarding' AND indexname = 'user_onboarding_status_idx') THEN
        DROP INDEX IF EXISTS user_onboarding_status_idx;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped user_onboarding_status_idx (user_onboarding table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'user_onboarding' AND indexname = 'user_onboarding_stage_idx') THEN
        DROP INDEX IF EXISTS user_onboarding_stage_idx;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped user_onboarding_stage_idx (user_onboarding table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    -- Onboarding tables (all the onboarding-related indexes)
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'onboarding_questions' AND indexname = 'onboarding_questions_theme_gin') THEN
        DROP INDEX IF EXISTS onboarding_questions_theme_gin;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped onboarding_questions_theme_gin (onboarding_questions table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'onboarding_responses' AND indexname = 'onboarding_responses_user_idx') THEN
        DROP INDEX IF EXISTS onboarding_responses_user_idx;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped onboarding_responses_user_idx (onboarding_responses table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'onboarding_responses' AND indexname = 'onboarding_responses_stage_idx') THEN
        DROP INDEX IF EXISTS onboarding_responses_stage_idx;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped onboarding_responses_stage_idx (onboarding_responses table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'onboarding_responses' AND indexname = 'onboarding_responses_resp_gin') THEN
        DROP INDEX IF EXISTS onboarding_responses_resp_gin;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped onboarding_responses_resp_gin (onboarding_responses table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    -- Message feedback
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'message_feedback' AND indexname = 'idx_message_feedback_session_id') THEN
        DROP INDEX IF EXISTS idx_message_feedback_session_id;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_message_feedback_session_id (message_feedback table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'message_feedback' AND indexname = 'idx_message_feedback_user_id') THEN
        DROP INDEX IF EXISTS idx_message_feedback_user_id;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_message_feedback_user_id (message_feedback table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'message_feedback' AND indexname = 'idx_message_feedback_message_id') THEN
        DROP INDEX IF EXISTS idx_message_feedback_message_id;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_message_feedback_message_id (message_feedback table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    -- More unused indexes...
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'memory_updates' AND indexname = 'idx_memory_updates_user_created') THEN
        DROP INDEX IF EXISTS idx_memory_updates_user_created;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_memory_updates_user_created (memory_updates table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    -- Some from the PRD v2 tables...
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'parts_v2' AND indexname = 'idx_parts_v2_search') THEN
        DROP INDEX IF EXISTS idx_parts_v2_search;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_parts_v2_search (parts_v2 table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'sessions_v2' AND indexname = 'idx_sessions_v2_active') THEN
        DROP INDEX IF EXISTS idx_sessions_v2_active;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_sessions_v2_active (sessions_v2 table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'observations' AND indexname = 'idx_observations_session') THEN
        DROP INDEX IF EXISTS idx_observations_session;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_observations_session (observations table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'observations' AND indexname = 'idx_observations_search') THEN
        DROP INDEX IF EXISTS idx_observations_search;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_observations_search (observations table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'observations' AND indexname = 'idx_observations_entities') THEN
        DROP INDEX IF EXISTS idx_observations_entities;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_observations_entities (observations table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'part_relationships_v2' AND indexname = 'idx_part_relationships_v2_part_a') THEN
        DROP INDEX IF EXISTS idx_part_relationships_v2_part_a;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_part_relationships_v2_part_a (part_relationships_v2 table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'part_relationships_v2' AND indexname = 'idx_part_relationships_v2_part_b') THEN
        DROP INDEX IF EXISTS idx_part_relationships_v2_part_b;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_part_relationships_v2_part_b (part_relationships_v2 table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'timeline_events' AND indexname = 'idx_timeline_events_user') THEN
        DROP INDEX IF EXISTS idx_timeline_events_user;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_timeline_events_user (timeline_events table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    -- A few more from inbox-related tables
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'inbox_observation_telemetry' AND indexname = 'idx_inbox_observation_telemetry_user_created_at') THEN
        DROP INDEX IF EXISTS idx_inbox_observation_telemetry_user_created_at;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped idx_inbox_observation_telemetry_user_created_at (inbox_observation_telemetry table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'observation_events' AND indexname = 'observation_events_observation_idx') THEN
        DROP INDEX IF EXISTS observation_events_observation_idx;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped observation_events_observation_idx (observation_events table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'observation_events' AND indexname = 'observation_events_user_idx') THEN
        DROP INDEX IF EXISTS observation_events_user_idx;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped observation_events_user_idx (observation_events table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'inbox_observations' AND indexname = 'inbox_observations_action_timestamp_idx') THEN
        DROP INDEX IF EXISTS inbox_observations_action_timestamp_idx;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped inbox_observations_action_timestamp_idx (inbox_observations table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'inbox_observations' AND indexname = 'inbox_observations_dismissed_at_idx') THEN
        DROP INDEX IF EXISTS inbox_observations_dismissed_at_idx;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped inbox_observations_dismissed_at_idx (inbox_observations table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'inbox_job_runs' AND indexname = 'inbox_job_runs_name_idx') THEN
        DROP INDEX IF EXISTS inbox_job_runs_name_idx;
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped inbox_job_runs_name_idx (inbox_job_runs table)';
    ELSE
        skipped_count := skipped_count + 1;
    END IF;
    
    RAISE NOTICE 'Unused index cleanup completed. % indexes dropped, % skipped.', dropped_count, skipped_count;
    
    IF confirm_unused_indexes_drop AND dropped_count > 0 THEN
        RAISE NOTICE 'STORAGE SAVED: Approximate space freed by removing % unused indexes.', dropped_count;
    END IF;
END$$;

-- Add a comment to document the change
COMMENT ON SCHEMA public IS 'Unused indexes removed to reduce storage overhead and improve write performance (migration 117) - To re-enable safety, set confirm_unused_indexes_drop = false';
