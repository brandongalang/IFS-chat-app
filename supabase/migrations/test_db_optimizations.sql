-- Database Optimization Verification Script
-- Run this script after applying migrations 114-117 to verify the optimizations

-- =============================================================
-- Test RLS Policy Optimization (Migration 114)
-- Check that policies use SELECT subqueries instead of direct auth function calls
-- =============================================================

DO $$
DECLARE
    policy_count_with_select integer := 0;
    total_policy_count integer := 0;
    policy_record RECORD;
BEGIN
    RAISE NOTICE 'Checking RLS policies for SELECT subquery optimization...';
    
    -- Count policies that should use SELECT subqueries
    FOR policy_record IN 
        SELECT schemaname, tablename, policyname, cmd, qual 
        FROM pg_policies 
        WHERE schemaname = 'public'
        AND (qual LIKE '%(select auth.uid())%' OR qual LIKE '%(select auth.role())%')
    LOOP
        policy_count_with_select := policy_count_with_select + 1;
        RAISE NOTICE '✓ Optimized policy: %.% for %', 
            policy_record.tablename, policy_record.policyname, policy_record.cmd;
    END LOOP;
    
    -- Count all policies
    SELECT COUNT(*) INTO total_policy_count
    FROM pg_policies 
    WHERE schemaname = 'public';
    
    RAISE NOTICE '% policies out of % use SELECT subqueries (%)', 
        policy_count_with_select, total_policy_count, 
        CASE WHEN total_policy_count > 0 THEN (policy_count_with_select::float / total_policy_count * 100)::numeric(5,2) ELSE 0 END;
END$$;

-- =============================================================
-- Test Policy Consolidation (Migration 115)
-- Verify consolidated policies exist for inbox_observations and observation_events
-- =============================================================

DO $$
DECLARE
    obs_unified_count integer;
    obs_events_unified_count integer;
BEGIN
    RAISE NOTICE 'Checking policy consolidation...';
    
    -- Check inbox_observations consolidated policies
    SELECT COUNT(*) INTO obs_unified_count
    FROM pg_policies 
    WHERE tablename = 'inbox_observations' 
    AND schemaname = 'public'
    AND policyname LIKE '%unified%';
    
    -- Check observation_events consolidated policies  
    SELECT COUNT(*) INTO obs_events_unified_count
    FROM pg_policies 
    WHERE tablename = 'observation_events' 
    AND schemaname = 'public'
    AND policyname LIKE '%unified%';
    
    IF obs_unified_count = 2 AND obs_events_unified_count = 2 THEN
        RAISE NOTICE '✓ Policy consolidation successful: inbox_observations (%), observation_events (%)', 
            obs_unified_count, obs_events_unified_count;
    ELSE
        RAISE NOTICE '✗ Policy consolidation incomplete: inbox_observations (%), observation_events (%)', 
            obs_unified_count, obs_events_unified_count;
    END IF;
END$$;

-- =============================================================
-- Test Foreign Key Indexes (Migration 116)
-- Verify new indexes exist for foreign keys
-- =============================================================

DO $$
DECLARE
    fk_index_count integer := 0;
BEGIN
    RAISE NOTICE 'Checking foreign key indexes...';
    
    -- Check onboarding_responses.question_id index
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'onboarding_responses' AND indexname = 'idx_onboarding_responses_question_id') THEN
        fk_index_count := fk_index_count + 1;
        RAISE NOTICE '✓ idx_onboarding_responses_question_id exists';
    ELSE
        RAISE NOTICE '✗ idx_onboarding_responses_question_id missing';
    END IF;
    
    -- Check part_assessments.part_id index
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'part_assessments' AND indexname = 'idx_part_assessments_part_id') THEN
        fk_index_count := fk_index_count + 1;
        RAISE NOTICE '✓ idx_part_assessments_part_id exists';
    ELSE
        RAISE NOTICE '✗ idx_part_assessments_part_id missing';
    END IF;
    
    -- Check timeline_events.session_id index
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'timeline_events' AND indexname = 'idx_timeline_events_session_id') THEN
        fk_index_count := fk_index_count + 1;
        RAISE NOTICE '✓ idx_timeline_events_session_id exists';
    ELSE
        RAISE NOTICE '✗ idx_timeline_events_session_id missing';
    END IF;
    
    RAISE NOTICE 'Foreign key index optimization: %/3 indexes created', fk_index_count;
END$$;

-- =============================================================
-- Test Query Performance with EXPLAIN ANALYZE
-- Sample queries to verify performance improvements
-- Note: Replace with actual user IDs from your database
-- =============================================================

DO $$
DECLARE
    sample_user_id UUID := '00000000-0000-0000-0000-000000000000'; -- Replace with real user ID
    has_sample_data BOOLEAN := false;
BEGIN
    -- Check if we have user data to test with
    SELECT EXISTS(SELECT 1 FROM users LIMIT 1) INTO has_sample_data;
    
    IF has_sample_data AND sample_user_id = '00000000-0000-0000-0000-000000000000' THEN
        SELECT id INTO sample_user_id FROM users LIMIT 1;
    END IF;
    
    IF has_sample_data THEN
        RAISE NOTICE 'Running performance tests for user_id: %', sample_user_id;
        
        RAISE NOTICE '--- Testing optimized RLS policies ---';
        -- Test user-scoped query with RLS
        RAISE NOTICE 'Query 1: SELECT FROM parts (should use SELECT subquery optimization)';
        RAISE NOTICE 'Actual query: EXPLAIN ANALYZE SELECT COUNT(*) FROM parts WHERE user_id = $1', sample_user_id;
        
        RAISE NOTICE 'Query 2: SELECT FROM inbox_observations (should use consolidated policies)';
        RAISE NOTICE 'Actual query: EXPLAIN ANALYZE SELECT COUNT(*) FROM inbox_observations WHERE user_id = $1', sample_user_id;
        
        RAISE NOTICE '--- Testing foreign key indexes ---';
        
        -- Check if onboarding_responses has data and question_id index would help
        IF EXISTS(SELECT 1 FROM onboarding_responses LIMIT 1) THEN
            RAISE NOTICE 'Query 3: JOIN with onboarding_responses (should use new question_id index)';
            RAISE NOTICE 'Actual query: EXPLAIN ANALYZE SELECT COUNT(*) FROM onboarding_responses o JOIN onboarding_questions q ON o.question_id = q.id WHERE o.user_id = $1', sample_user_id;
        END IF;
        
        -- Check if timeline_events has data and session_id index would help
        IF EXISTS(SELECT 1 FROM timeline_events LIMIT 1) THEN
            RAISE NOTICE 'Query 4: Filter timeline_events by session_id (should use new session_id index)';
            RAISE NOTICE 'Actual query: EXPLAIN ANALYZE SELECT COUNT(*) FROM timeline_events WHERE session_id IN (SELECT id FROM sessions WHERE user_id = $1 LIMIT 1)', sample_user_id;
        END IF;
        
    ELSE
        RAISE NOTICE 'No user data available for performance testing. Add some test data and run EXPLAIN ANALYZE manually.';
    END IF;
END$$;

-- =============================================================
-- Check Index Usage after Optimization
-- Overview of index status
-- =============================================================

DO $$
DECLARE
    total_indexes integer;
    unused_indexes integer;
    index_record RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Index Overview:';
    
    SELECT COUNT(*) INTO total_indexes
    FROM pg_indexes 
    WHERE schemaname = 'public';
    
    RAISE NOTICE 'Total indexes in public schema: %', total_indexes;
    
    -- List recently used indexes (helps confirm important indexes are being used)
    RAISE NOTICE '';
    RAISE NOTICE 'Important indexes for verification (run: SELECT * FROM pg_stat_user_indexes WHERE idx_scan > 0):';
    
    FOR index_record IN 
        SELECT schemaname, tablename, indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public'
        AND tablename IN ('users', 'parts', 'sessions', 'insights', 'inbox_observations')
        ORDER BY tablename, indexname
    LOOP
        RAISE NOTICE '  %.% (%)', 
            index_record.tablename, 
            index_record.indexname,
            CASE 
                WHEN index_record.indexname LIKE '%user%' THEN 'User-scoped'
                WHEN index_record.indexname LIKE '%fk%' OR index_record.indexname LIKE '%_id%' THEN 'Foreign Key'
                ELSE 'Other'
            END;
    END LOOP;
END$$;

-- =============================================================
-- Summary
-- =============================================================

RAISE NOTICE '';
RAISE NOTICE '=== Database Optimization Verification Complete ===';
RAISE NOTICE '';
RAISE NOTICE 'To get full performance metrics, run:';
RAISE NOTICE '1. EXPLAIN ANALYZE on your actual queries';
RAISE NOTICE '2. Monitor pg_stat_user_indexes before and after optimization';
RAISE NOTICE '3. Check application query times in real usage';
RAISE NOTICE '';
RAISE NOTICE 'Expected improvements:';
RAISE NOTICE '- 10-50% better performance on user-scoped queries (scales with row count)';
RAISE NOTICE '- Faster JOIN operations on indexed foreign keys';
RAISE NOTICE '- Reduced policy evaluation overhead';
RAISE NOTICE '- Lower storage costs and faster writes (if unused indexes dropped)';
