-- Consolidate Multiple Permissive Policies
-- Migration: 115_consolidate_permissive_policies
-- Purpose: Fix multiple_permissive_policies warnings by consolidating policies
-- Impact: Reduces policy evaluation overhead for roles with multiple overlapping policies

-- =============================================================
-- Inbox Observations table
-- Consolidate users_select_own_observations and service_role_manage_observations
-- =============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "users_select_own_observations" ON public.inbox_observations;
DROP POLICY IF EXISTS "service_role_manage_observations" ON public.inbox_observations;

-- Create consolidated policies
CREATE POLICY "inbox_observations_unified_select" ON public.inbox_observations
  FOR SELECT
  USING (
    (select auth.uid()) = user_id OR 
    (select auth.role()) = 'service_role'
  );

CREATE POLICY "inbox_observations_unified_all" ON public.inbox_observations
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
-- Observation Events table
-- Consolidate users_select_own_observation_events and service_role_manage_observation_events
-- =============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "users_select_own_observation_events" ON public.observation_events;
DROP POLICY IF EXISTS "service_role_manage_observation_events" ON public.observation_events;

-- Create consolidated policies
CREATE POLICY "observation_events_unified_select" ON public.observation_events
  FOR SELECT
  USING (
    (select auth.uid()) = user_id OR 
    (select auth.role()) = 'service_role'
  );

CREATE POLICY "observation_events_unified_all" ON public.observation_events
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
-- Verify policy creation
-- =============================================================

-- Check that policies exist and are correct
DO $$
DECLARE
    obs_policy_count integer;
    obs_events_policy_count integer;
BEGIN
    -- Check inbox_observations policies
    SELECT COUNT(*) INTO obs_policy_count
    FROM pg_policies 
    WHERE tablename = 'inbox_observations' 
    AND schemaname = 'public';
    
    -- Check observation_events policies  
    SELECT COUNT(*) INTO obs_events_policy_count
    FROM pg_policies 
    WHERE tablename = 'observation_events' 
    AND schemaname = 'public';
    
    RAISE NOTICE 'inbox_observations policy count: %, observation_events policy count: %', 
        obs_policy_count, obs_events_policy_count;
        
    IF obs_policy_count = 2 AND obs_events_policy_count = 2 THEN
        RAISE NOTICE 'Policy consolidation successful!';
    ELSE
        RAISE NOTICE 'Warning: Expected 2 policies per table, got % and %', 
            obs_policy_count, obs_events_policy_count;
    END IF;
END$$;

COMMENT ON SCHEMA public IS 'Multiple permissive policies consolidated to reduce evaluation overhead';
