-- Add Missing Foreign Key Indexes
-- Migration: 116_add_missing_fk_indexes  
-- Purpose: Fix unindexed foreign key warnings identified by database linter
-- Impact: Improves performance of JOIN operations and FK constraint checks

-- =============================================================
-- Onboarding Responses table
-- Add index for question_id foreign key
-- =============================================================

-- Check if the foreign key exists before creating index
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint pc
        JOIN pg_class pt ON pc.conrelid = pt.oid
        JOIN pg_namespace pn ON pn.oid = pt.relnamespace
        WHERE pn.nspname = 'public'
        AND pt.relname = 'onboarding_responses'
        AND pc.conname = 'onboarding_responses_question_id_fkey'
        AND pc.contype = 'f'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_onboarding_responses_question_id 
            ON public.onboarding_responses(question_id);
            
        RAISE NOTICE 'Created index idx_onboarding_responses_question_id for foreign key constraint';
    ELSE
        RAISE NOTICE 'Foreign key onboarding_responses_question_id_fkey not found, index not created';
    END IF;
END$$;

-- =============================================================
-- Part Assessments table  
-- Add index for part_id foreign key
-- =============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint pc
        JOIN pg_class pt ON pc.conrelid = pt.oid
        JOIN pg_namespace pn ON pn.oid = pt.relnamespace
        WHERE pn.nspname = 'public'
        AND pt.relname = 'part_assessments'
        AND pc.conname = 'part_assessments_part_id_fkey'
        AND pc.contype = 'f'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_part_assessments_part_id 
            ON public.part_assessments(part_id);
            
        RAISE NOTICE 'Created index idx_part_assessments_part_id for foreign key constraint';
    ELSE
        RAISE NOTICE 'Foreign key part_assessments_part_id_fkey not found, index not created';
    END IF;
END$$;

-- =============================================================
-- Timeline Events table
-- Add index for session_id foreign key  
-- =============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint pc
        JOIN pg_class pt ON pc.conrelid = pt.oid
        JOIN pg_namespace pn ON pn.oid = pt.relnamespace
        WHERE pn.nspname = 'public'
        AND pt.relname = 'timeline_events'
        AND pc.conname = 'timeline_events_session_id_fkey'
        AND pc.contype = 'f'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_timeline_events_session_id 
            ON public.timeline_events(session_id);
            
        RAISE NOTICE 'Created index idx_timeline_events_session_id for foreign key constraint';
    ELSE
        RAISE NOTICE 'Foreign key timeline_events_session_id_fkey not found, index not created';
    END IF;
END$$;

-- =============================================================
-- Verification script
-- Confirm indexes were created successfully
-- =============================================================

DO $$
DECLARE
    index_counter integer := 0;
BEGIN
    -- Check onboarding_responses index
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'onboarding_responses' 
        AND indexname = 'idx_onboarding_responses_question_id'
        AND schemaname = 'public'
    ) THEN
        index_counter := index_counter + 1;
        RAISE NOTICE '✓ idx_onboarding_responses_question_id created successfully';
    ELSE
        RAISE NOTICE '✗ idx_onboarding_responses_question_id not found';
    END IF;
    
    -- Check part_assessments index
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'part_assessments' 
        AND indexname = 'idx_part_assessments_part_id'
        AND schemaname = 'public'
    ) THEN
        index_counter := index_counter + 1;
        RAISE NOTICE '✓ idx_part_assessments_part_id created successfully';
    ELSE
        RAISE NOTICE '✗ idx_part_assessments_part_id not found';
    END IF;
    
    -- Check timeline_events index
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'timeline_events' 
        AND indexname = 'idx_timeline_events_session_id'
        AND schemaname = 'public'
    ) THEN
        index_counter := index_counter + 1;
        RAISE NOTICE '✓ idx_timeline_events_session_id created successfully';
    ELSE
        RAISE NOTICE '✗ idx_timeline_events_session_id not found';
    END IF;
    
    RAISE NOTICE 'Foreign key indexing optimization completed. %/3 indexes successfully created.', index_counter;
END$$;

COMMENT ON SCHEMA public IS 'Added missing foreign key indexes to improve JOIN performance';
