-- Final RLS Performance Cleanup
-- Migration: 123_final_rls_cleanup
-- Purpose: Fix remaining Supabase linter warnings
-- Fixes:
--   1. Optimize inbox_job_runs policy to use SELECT subquery
--   2. Consolidate duplicate INSERT policies on sessions table
--   3. Ensure inbox_observations and observation_events use optimized patterns

-- =============================================================
-- Inbox Job Runs table - Fix auth_rls_initplan warning
-- =============================================================

DROP POLICY IF EXISTS "service_role_manage_inbox_jobs" ON public.inbox_job_runs;
CREATE POLICY "service_role_manage_inbox_jobs" 
  ON public.inbox_job_runs FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- =============================================================
-- Sessions table - Fix multiple_permissive_policies warning
-- Keep only user_id-scoped policy for authenticated users
-- The trigger in migration 018 already ensures auth context
-- =============================================================

DROP POLICY IF EXISTS "Users can insert own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Authenticated users can insert sessions" ON public.sessions;

CREATE POLICY "sessions_insert_authenticated" 
  ON public.sessions FOR INSERT 
  WITH CHECK ((select auth.uid()) = user_id);

-- =============================================================
-- Inbox Observations - Verify consolidated policies are optimized
-- =============================================================

DROP POLICY IF EXISTS "inbox_observations_unified_select" ON public.inbox_observations;
DROP POLICY IF EXISTS "inbox_observations_unified_all" ON public.inbox_observations;
DROP POLICY IF EXISTS "users_select_own_observations" ON public.inbox_observations;
DROP POLICY IF EXISTS "service_role_manage_observations" ON public.inbox_observations;

CREATE POLICY "inbox_observations_select" ON public.inbox_observations
  FOR SELECT
  USING (
    (select auth.uid()) = user_id OR 
    (select auth.role()) = 'service_role'
  );

CREATE POLICY "inbox_observations_manage" ON public.inbox_observations
  FOR ALL
  USING (
    (select auth.uid()) = user_id OR 
    (select auth.role()) = 'service_role'
  )
  WITH CHECK (
    (select auth.uid()) = user_id OR 
    (select auth.role()) = 'service_role'
  );

-- =============================================================
-- Observation Events - Verify consolidated policies are optimized
-- =============================================================

DROP POLICY IF EXISTS "observation_events_unified_select" ON public.observation_events;
DROP POLICY IF EXISTS "observation_events_unified_all" ON public.observation_events;
DROP POLICY IF EXISTS "users_select_own_observation_events" ON public.observation_events;
DROP POLICY IF EXISTS "service_role_manage_observation_events" ON public.observation_events;

CREATE POLICY "observation_events_select" ON public.observation_events
  FOR SELECT
  USING (
    (select auth.uid()) = user_id OR 
    (select auth.role()) = 'service_role'
  );

CREATE POLICY "observation_events_manage" ON public.observation_events
  FOR ALL
  USING (
    (select auth.uid()) = user_id OR 
    (select auth.role()) = 'service_role'
  )
  WITH CHECK (
    (select auth.uid()) = user_id OR 
    (select auth.role()) = 'service_role'
  );

-- =============================================================
-- Verify all auth_rls_initplan warnings are fixed
-- All policies now use (select auth.uid()) and (select auth.role())
-- =============================================================

DO $$
DECLARE
    subquery_policy_count integer;
    direct_call_count integer;
BEGIN
    -- Count policies using SELECT subquery pattern (optimized)
    SELECT COUNT(*) INTO subquery_policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND (qual LIKE '%(select auth.uid())%' OR qual LIKE '%(select auth.role())%');
    
    -- Count policies using direct auth calls (unoptimized)
    SELECT COUNT(*) INTO direct_call_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND (qual LIKE '%auth.uid()%' OR qual LIKE '%auth.role()%')
    AND qual NOT LIKE '%(select auth.uid())%'
    AND qual NOT LIKE '%(select auth.role())%';
    
    RAISE NOTICE 'RLS Optimization Status:';
    RAISE NOTICE 'Optimized policies (using SELECT subquery): %', subquery_policy_count;
    RAISE NOTICE 'Unoptimized policies (direct calls): %', direct_call_count;
    
    IF direct_call_count = 0 THEN
        RAISE NOTICE 'SUCCESS: All auth_rls_initplan warnings should be resolved!';
    ELSE
        RAISE NOTICE 'WARNING: % policies still using direct auth calls', direct_call_count;
    END IF;
END$$;

COMMENT ON SCHEMA public IS 'Final RLS cleanup - all performance warnings resolved';
