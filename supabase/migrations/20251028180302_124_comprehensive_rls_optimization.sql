-- Comprehensive RLS Optimization - Fix all remaining auth_rls_initplan warnings
-- This migration replaces ALL direct auth.uid() and auth.role() calls with SELECT subqueries
-- Purpose: Resolve 50+ Supabase database linter warnings

-- Part Relationships
DROP POLICY IF EXISTS "Users can view own part relationships" ON public.part_relationships;
CREATE POLICY "Users can view own part relationships" ON public.part_relationships FOR SELECT USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "Users can insert own part relationships" ON public.part_relationships;
CREATE POLICY "Users can insert own part relationships" ON public.part_relationships FOR INSERT WITH CHECK (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "Users can update own part relationships" ON public.part_relationships;
CREATE POLICY "Users can update own part relationships" ON public.part_relationships FOR UPDATE USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "Users can delete own part relationships" ON public.part_relationships;
CREATE POLICY "Users can delete own part relationships" ON public.part_relationships FOR DELETE USING (((SELECT auth.uid()) = user_id));

-- Message Feedback
DROP POLICY IF EXISTS "Users can view their own feedback" ON public.message_feedback;
CREATE POLICY "Users can view their own feedback" ON public.message_feedback FOR SELECT USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "Users can insert their own feedback" ON public.message_feedback;
CREATE POLICY "Users can insert their own feedback" ON public.message_feedback FOR INSERT WITH CHECK (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "Users can update their own feedback" ON public.message_feedback;
CREATE POLICY "Users can update their own feedback" ON public.message_feedback FOR UPDATE USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "Users can delete their own feedback" ON public.message_feedback;
CREATE POLICY "Users can delete their own feedback" ON public.message_feedback FOR DELETE USING (((SELECT auth.uid()) = user_id));

-- Events  
DROP POLICY IF EXISTS "Users can view own events" ON public.events;
CREATE POLICY "Users can view own events" ON public.events FOR SELECT USING ((user_id = (SELECT auth.uid())));

-- Memory Updates
DROP POLICY IF EXISTS "Users can view own memory updates" ON public.memory_updates;
CREATE POLICY "Users can view own memory updates" ON public.memory_updates FOR SELECT USING (((SELECT auth.uid()) = user_id));

-- Observations
DROP POLICY IF EXISTS "observations_select_own" ON public.observations;
CREATE POLICY "observations_select_own" ON public.observations FOR SELECT USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "observations_insert_own" ON public.observations;
CREATE POLICY "observations_insert_own" ON public.observations FOR INSERT WITH CHECK (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "observations_update_own" ON public.observations;
CREATE POLICY "observations_update_own" ON public.observations FOR UPDATE USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "observations_delete_own" ON public.observations;
CREATE POLICY "observations_delete_own" ON public.observations FOR DELETE USING (((SELECT auth.uid()) = user_id));

-- Onboarding Responses
DROP POLICY IF EXISTS "onboarding_responses_select_own" ON public.onboarding_responses;
CREATE POLICY "onboarding_responses_select_own" ON public.onboarding_responses FOR SELECT USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "onboarding_responses_insert_own" ON public.onboarding_responses;
CREATE POLICY "onboarding_responses_insert_own" ON public.onboarding_responses FOR INSERT WITH CHECK (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "onboarding_responses_update_own" ON public.onboarding_responses;
CREATE POLICY "onboarding_responses_update_own" ON public.onboarding_responses FOR UPDATE USING (((SELECT auth.uid()) = user_id)) WITH CHECK (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "onboarding_responses_delete_own" ON public.onboarding_responses;
CREATE POLICY "onboarding_responses_delete_own" ON public.onboarding_responses FOR DELETE USING (((SELECT auth.uid()) = user_id));

-- Part Relationships V2
DROP POLICY IF EXISTS "part_relationships_v2_select_own" ON public.part_relationships_v2;
CREATE POLICY "part_relationships_v2_select_own" ON public.part_relationships_v2 FOR SELECT USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "part_relationships_v2_insert_own" ON public.part_relationships_v2;
CREATE POLICY "part_relationships_v2_insert_own" ON public.part_relationships_v2 FOR INSERT WITH CHECK (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "part_relationships_v2_update_own" ON public.part_relationships_v2;
CREATE POLICY "part_relationships_v2_update_own" ON public.part_relationships_v2 FOR UPDATE USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "part_relationships_v2_delete_own" ON public.part_relationships_v2;
CREATE POLICY "part_relationships_v2_delete_own" ON public.part_relationships_v2 FOR DELETE USING (((SELECT auth.uid()) = user_id));

-- Parts V2
DROP POLICY IF EXISTS "parts_v2_select_own" ON public.parts_v2;
CREATE POLICY "parts_v2_select_own" ON public.parts_v2 FOR SELECT USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "parts_v2_insert_own" ON public.parts_v2;
CREATE POLICY "parts_v2_insert_own" ON public.parts_v2 FOR INSERT WITH CHECK (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "parts_v2_update_own" ON public.parts_v2;
CREATE POLICY "parts_v2_update_own" ON public.parts_v2 FOR UPDATE USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "parts_v2_delete_own" ON public.parts_v2;
CREATE POLICY "parts_v2_delete_own" ON public.parts_v2 FOR DELETE USING (((SELECT auth.uid()) = user_id));

-- Sessions V2
DROP POLICY IF EXISTS "sessions_v2_select_own" ON public.sessions_v2;
CREATE POLICY "sessions_v2_select_own" ON public.sessions_v2 FOR SELECT USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "sessions_v2_insert_own" ON public.sessions_v2;
CREATE POLICY "sessions_v2_insert_own" ON public.sessions_v2 FOR INSERT WITH CHECK (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "sessions_v2_update_own" ON public.sessions_v2;
CREATE POLICY "sessions_v2_update_own" ON public.sessions_v2 FOR UPDATE USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "sessions_v2_delete_own" ON public.sessions_v2;
CREATE POLICY "sessions_v2_delete_own" ON public.sessions_v2 FOR DELETE USING (((SELECT auth.uid()) = user_id));

-- Timeline Events
DROP POLICY IF EXISTS "timeline_events_select_own" ON public.timeline_events;
CREATE POLICY "timeline_events_select_own" ON public.timeline_events FOR SELECT USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "timeline_events_insert_own" ON public.timeline_events;
CREATE POLICY "timeline_events_insert_own" ON public.timeline_events FOR INSERT WITH CHECK (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "timeline_events_update_own" ON public.timeline_events;
CREATE POLICY "timeline_events_update_own" ON public.timeline_events FOR UPDATE USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "timeline_events_delete_own" ON public.timeline_events;
CREATE POLICY "timeline_events_delete_own" ON public.timeline_events FOR DELETE USING (((SELECT auth.uid()) = user_id));

-- User Onboarding
DROP POLICY IF EXISTS "user_onboarding_select_own" ON public.user_onboarding;
CREATE POLICY "user_onboarding_select_own" ON public.user_onboarding FOR SELECT USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "user_onboarding_insert_own" ON public.user_onboarding;
CREATE POLICY "user_onboarding_insert_own" ON public.user_onboarding FOR INSERT WITH CHECK (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "user_onboarding_update_own" ON public.user_onboarding;
CREATE POLICY "user_onboarding_update_own" ON public.user_onboarding FOR UPDATE USING (((SELECT auth.uid()) = user_id)) WITH CHECK (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "user_onboarding_delete_own" ON public.user_onboarding;
CREATE POLICY "user_onboarding_delete_own" ON public.user_onboarding FOR DELETE USING (((SELECT auth.uid()) = user_id));

-- Inbox Message Events
DROP POLICY IF EXISTS "users_select_own_inbox_events" ON public.inbox_message_events;
CREATE POLICY "users_select_own_inbox_events" ON public.inbox_message_events FOR SELECT USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "users_insert_inbox_events" ON public.inbox_message_events;
CREATE POLICY "users_insert_inbox_events" ON public.inbox_message_events FOR INSERT WITH CHECK (((SELECT auth.uid()) = user_id));

-- Verify optimization
DO $$
DECLARE
    optimized_count integer;
    unoptimized_count integer;
BEGIN
    SELECT COUNT(*) INTO optimized_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND (qual LIKE '%(SELECT auth.uid())%' OR qual LIKE '%(SELECT auth.role())%');
    
    SELECT COUNT(*) INTO unoptimized_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND (qual LIKE '%auth.uid()%' OR qual LIKE '%auth.role()%')
    AND qual NOT LIKE '%(SELECT auth.uid())%'
    AND qual NOT LIKE '%(SELECT auth.role())%';
    
    RAISE NOTICE 'RLS Optimization Complete';
    RAISE NOTICE 'Optimized policies (SELECT subquery): %', optimized_count;
    RAISE NOTICE 'Remaining unoptimized policies: %', unoptimized_count;
END$$;
