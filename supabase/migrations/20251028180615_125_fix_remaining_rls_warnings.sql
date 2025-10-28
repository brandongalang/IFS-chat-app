-- Fix Remaining 10 RLS Performance Warnings
-- Fixes:
--   1. Part notes policies - optimize EXISTS subquery to use SELECT auth.uid()
--   2. Consolidate duplicate SELECT policies on inbox_observations and observation_events

-- =============================================================
-- Part Notes - Fix auth_rls_initplan warnings
-- =============================================================

DROP POLICY IF EXISTS "Users can view notes for own parts" ON public.part_notes;
CREATE POLICY "Users can view notes for own parts" ON public.part_notes FOR SELECT USING (
  EXISTS (
    SELECT 1 
    FROM public.parts 
    WHERE parts.id = part_notes.part_id 
    AND parts.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can add notes for own parts" ON public.part_notes;
CREATE POLICY "Users can add notes for own parts" ON public.part_notes FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.parts 
    WHERE parts.id = part_notes.part_id 
    AND parts.user_id = (SELECT auth.uid())
  )
);

-- =============================================================
-- Inbox Observations - Consolidate duplicate SELECT policies
-- Keep only the *_manage policy (which handles all operations)
-- =============================================================

DROP POLICY IF EXISTS "inbox_observations_select" ON public.inbox_observations;

-- =============================================================
-- Observation Events - Consolidate duplicate SELECT policies
-- Keep only the *_manage policy (which handles all operations)
-- =============================================================

DROP POLICY IF EXISTS "observation_events_select" ON public.observation_events;

-- =============================================================
-- Verify all warnings are resolved
-- =============================================================

DO $$
DECLARE
    part_notes_unoptimized integer;
    duplicate_select_count integer;
BEGIN
    -- Check part_notes for unoptimized auth calls in EXISTS
    SELECT COUNT(*) INTO part_notes_unoptimized
    FROM pg_policies
    WHERE tablename = 'part_notes'
    AND schemaname = 'public'
    AND (qual LIKE '%auth.uid()%' OR qual LIKE '%auth.role()%')
    AND qual NOT LIKE '%(SELECT auth.uid())%'
    AND qual NOT LIKE '%(SELECT auth.role())%';
    
    -- Check for duplicate SELECT policies
    SELECT COUNT(*) INTO duplicate_select_count
    FROM (
        SELECT tablename, policyname, COUNT(*) as cnt
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN ('inbox_observations', 'observation_events')
        AND policyname LIKE '%_select'
        GROUP BY tablename, policyname
    ) t;
    
    RAISE NOTICE 'Final RLS Warning Resolution:';
    RAISE NOTICE 'Unoptimized part_notes policies: %', part_notes_unoptimized;
    RAISE NOTICE 'Remaining *_select duplicate policies: %', duplicate_select_count;
    
    IF part_notes_unoptimized = 0 AND duplicate_select_count = 0 THEN
        RAISE NOTICE 'SUCCESS: All 10 warnings should be resolved!';
    END IF;
END$$;
