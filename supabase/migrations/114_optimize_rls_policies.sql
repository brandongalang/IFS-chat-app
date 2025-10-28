-- Optimize RLS Policies - Wrap auth functions in SELECT subqueries
-- Migration: 114_optimize_rls_policies
-- Purpose: Fix auth_rls_initplan warnings by wrapping auth.uid() and auth.role() in SELECT subqueries
-- Impact: Improves query performance by preventing re-evaluation per row

-- =============================================================
-- Users table
-- =============================================================

DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" 
    ON users FOR SELECT 
    USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" 
    ON users FOR UPDATE 
    USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile" 
    ON users FOR INSERT 
    WITH CHECK ((select auth.uid()) = id);

-- =============================================================
-- Parts table
-- =============================================================

DROP POLICY IF EXISTS "Users can view own parts" ON parts;
CREATE POLICY "Users can view own parts" 
    ON parts FOR SELECT 
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own parts" ON parts;
CREATE POLICY "Users can insert own parts" 
    ON parts FOR INSERT 
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own parts" ON parts;
CREATE POLICY "Users can update own parts" 
    ON parts FOR UPDATE 
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own parts" ON parts;
CREATE POLICY "Users can delete own parts" 
    ON parts FOR DELETE 
    USING ((select auth.uid()) = user_id);

-- =============================================================
-- Sessions table
-- =============================================================

DROP POLICY IF EXISTS "Users can view own sessions" ON sessions;
CREATE POLICY "Users can view own sessions" 
    ON sessions FOR SELECT 
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert sessions" ON sessions;
CREATE POLICY "Authenticated users can insert sessions" 
    ON sessions FOR INSERT 
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON sessions;
CREATE POLICY "Users can update own sessions" 
    ON sessions FOR UPDATE 
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own sessions" ON sessions;
CREATE POLICY "Users can delete own sessions" 
    ON sessions FOR DELETE 
    USING ((select auth.uid()) = user_id);

-- =============================================================
-- Part Relationships table
-- =============================================================

DROP POLICY IF EXISTS "Users can view own part relationships" ON part_relationships;
CREATE POLICY "Users can view own part relationships" 
    ON part_relationships FOR SELECT 
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own part relationships" ON part_relationships;
CREATE POLICY "Users can insert own part relationships" 
    ON part_relationships FOR INSERT 
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own part relationships" ON part_relationships;
CREATE POLICY "Users can update own part relationships" 
    ON part_relationships FOR UPDATE 
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own part relationships" ON part_relationships;
CREATE POLICY "Users can delete own part relationships" 
    ON part_relationships FOR DELETE 
    USING ((select auth.uid()) = user_id);

-- =============================================================
-- Events table
-- =============================================================

DROP POLICY IF EXISTS "Users can view own events" ON events;
CREATE POLICY "Users can view own events" 
    ON events FOR SELECT 
    USING (user_id = (select auth.uid()));

-- =============================================================
-- Insights table
-- =============================================================

DROP POLICY IF EXISTS "Users can view own insights" ON insights;
CREATE POLICY "Users can view own insights" 
    ON insights FOR SELECT 
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own insights" ON insights;
CREATE POLICY "Users can insert own insights" 
    ON insights FOR INSERT 
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own insights" ON insights;
CREATE POLICY "Users can update own insights" 
    ON insights FOR UPDATE 
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own insights" ON insights;
CREATE POLICY "Users can delete own insights" 
    ON insights FOR DELETE 
    USING ((select auth.uid()) = user_id);

-- =============================================================
-- Check Ins table
-- =============================================================

DROP POLICY IF EXISTS "Users can view own check_ins" ON check_ins;
CREATE POLICY "Users can view own check_ins" 
    ON check_ins FOR SELECT 
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own check_ins" ON check_ins;
CREATE POLICY "Users can insert own check_ins" 
    ON check_ins FOR INSERT 
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own check_ins" ON check_ins;
CREATE POLICY "Users can update own check_ins" 
    ON check_ins FOR UPDATE 
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own check_ins" ON check_ins;
CREATE POLICY "Users can delete own check_ins" 
    ON check_ins FOR DELETE 
    USING ((select auth.uid()) = user_id);

-- =============================================================
-- User Onboarding table
-- =============================================================

DROP POLICY IF EXISTS "user_onboarding_select_own" ON user_onboarding;
CREATE POLICY "user_onboarding_select_own" 
    ON user_onboarding FOR SELECT 
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_onboarding_insert_own" ON user_onboarding;
CREATE POLICY "user_onboarding_insert_own" 
    ON user_onboarding FOR INSERT 
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_onboarding_update_own" ON user_onboarding;
CREATE POLICY "user_onboarding_update_own" 
    ON user_onboarding FOR UPDATE 
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_onboarding_delete_own" ON user_onboarding;
CREATE POLICY "user_onboarding_delete_own" 
    ON user_onboarding FOR DELETE 
    USING ((select auth.uid()) = user_id);

-- =============================================================
-- Onboarding Responses table
-- =============================================================

DROP POLICY IF EXISTS "onboarding_responses_select_own" ON onboarding_responses;
CREATE POLICY "onboarding_responses_select_own" 
    ON onboarding_responses FOR SELECT 
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "onboarding_responses_insert_own" ON onboarding_responses;
CREATE POLICY "onboarding_responses_insert_own" 
    ON onboarding_responses FOR INSERT 
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "onboarding_responses_update_own" ON onboarding_responses;
CREATE POLICY "onboarding_responses_update_own" 
    ON onboarding_responses FOR UPDATE 
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "onboarding_responses_delete_own" ON onboarding_responses;
CREATE POLICY "onboarding_responses_delete_own" 
    ON onboarding_responses FOR DELETE 
    USING ((select auth.uid()) = user_id);

-- =============================================================
-- Message Feedback table
-- =============================================================

DROP POLICY IF EXISTS "Users can view their own feedback" ON message_feedback;
CREATE POLICY "Users can view their own feedback" 
    ON message_feedback FOR SELECT 
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own feedback" ON message_feedback;
CREATE POLICY "Users can insert their own feedback" 
    ON message_feedback FOR INSERT 
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own feedback" ON message_feedback;
CREATE POLICY "Users can update their own feedback" 
    ON message_feedback FOR UPDATE 
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own feedback" ON message_feedback;
CREATE POLICY "Users can delete their own feedback" 
    ON message_feedback FOR DELETE 
    USING ((select auth.uid()) = user_id);

-- =============================================================
-- Memory Updates table
-- =============================================================

DROP POLICY IF EXISTS "Users can view own memory updates" ON memory_updates;
CREATE POLICY "Users can view own memory updates" 
    ON memory_updates FOR SELECT 
    USING ((select auth.uid()) = user_id);

-- =============================================================
-- Part Notes table
-- =============================================================

DROP POLICY IF EXISTS "Users can view notes for own parts" ON part_notes;
CREATE POLICY "Users can view notes for own parts" 
    ON part_notes FOR SELECT 
    USING (
      EXISTS (
        SELECT 1 
        FROM parts 
        WHERE parts.id = part_notes.part_id 
        AND parts.user_id = (select auth.uid())
      )
    );

DROP POLICY IF EXISTS "Users can add notes for own parts" ON part_notes;
CREATE POLICY "Users can add notes for own parts" 
    ON part_notes FOR INSERT 
    WITH CHECK (
      EXISTS (
        SELECT 1 
        FROM parts 
        WHERE parts.id = part_notes.part_id 
        AND parts.user_id = (select auth.uid())
      )
    );

-- =============================================================
-- Inbox Message Events table
-- =============================================================

DROP POLICY IF EXISTS "users_insert_inbox_events" ON inbox_message_events;
CREATE POLICY "users_insert_inbox_events" 
    ON inbox_message_events FOR INSERT 
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "users_select_own_inbox_events" ON inbox_message_events;
CREATE POLICY "users_select_own_inbox_events" 
    ON inbox_message_events FOR SELECT 
    USING ((select auth.uid()) = user_id);

-- =============================================================
-- Parts V2 table
-- =============================================================

DROP POLICY IF EXISTS parts_v2_select_own ON parts_v2;
CREATE POLICY parts_v2_select_own
  ON parts_v2
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS parts_v2_insert_own ON parts_v2;
CREATE POLICY parts_v2_insert_own
  ON parts_v2
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS parts_v2_update_own ON parts_v2;
CREATE POLICY parts_v2_update_own
  ON parts_v2
  FOR UPDATE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS parts_v2_delete_own ON parts_v2;
CREATE POLICY parts_v2_delete_own
  ON parts_v2
  FOR DELETE
  USING ((select auth.uid()) = user_id);

-- =============================================================
-- Sessions V2 table
-- =============================================================

DROP POLICY IF EXISTS sessions_v2_select_own ON sessions_v2;
CREATE POLICY sessions_v2_select_own
  ON sessions_v2
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS sessions_v2_insert_own ON sessions_v2;
CREATE POLICY sessions_v2_insert_own
  ON sessions_v2
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS sessions_v2_update_own ON sessions_v2;
CREATE POLICY sessions_v2_update_own
  ON sessions_v2
  FOR UPDATE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS sessions_v2_delete_own ON sessions_v2;
CREATE POLICY sessions_v2_delete_own
  ON sessions_v2
  FOR DELETE
  USING ((select auth.uid()) = user_id);

-- =============================================================
-- Observations table
-- =============================================================

DROP POLICY IF EXISTS observations_select_own ON observations;
CREATE POLICY observations_select_own
  ON observations
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS observations_insert_own ON observations;
CREATE POLICY observations_insert_own
  ON observations
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS observations_update_own ON observations;
CREATE POLICY observations_update_own
  ON observations
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS observations_delete_own ON observations;
CREATE POLICY observations_delete_own
  ON observations
  FOR DELETE
  USING ((select auth.uid()) = user_id);

-- =============================================================
-- Part Relationships V2 table
-- =============================================================

DROP POLICY IF EXISTS part_relationships_v2_select_own ON part_relationships_v2;
CREATE POLICY part_relationships_v2_select_own
  ON part_relationships_v2
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS part_relationships_v2_insert_own ON part_relationships_v2;
CREATE POLICY part_relationships_v2_insert_own
  ON part_relationships_v2
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS part_relationships_v2_update_own ON part_relationships_v2;
CREATE POLICY part_relationships_v2_update_own
  ON part_relationships_v2
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS part_relationships_v2_delete_own ON part_relationships_v2;
CREATE POLICY part_relationships_v2_delete_own
  ON part_relationships_v2
  FOR DELETE
  USING ((select auth.uid()) = user_id);

-- =============================================================
-- Timeline Events table
-- =============================================================

DROP POLICY IF EXISTS timeline_events_select_own ON timeline_events;
CREATE POLICY timeline_events_select_own
  ON timeline_events
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS timeline_events_insert_own ON timeline_events;
CREATE POLICY timeline_events_insert_own
  ON timeline_events
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS timeline_events_update_own ON timeline_events;
CREATE POLICY timeline_events_update_own
  ON timeline_events
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS timeline_events_delete_own ON timeline_events;
CREATE POLICY timeline_events_delete_own
  ON timeline_events
  FOR DELETE
  USING ((select auth.uid()) = user_id);

-- =============================================================
-- Memory Snapshots Bucket policies (if they exist)
-- =============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage'
        AND policyname = 'Users can upload memory snapshots'
    ) THEN
        DROP POLICY IF EXISTS "Users can upload memory snapshots" ON storage.objects;
        CREATE POLICY "Users can upload memory snapshots" ON storage.objects
          FOR INSERT WITH CHECK (
            bucket_id = 'memory-snapshots'
            AND (storage.foldername(name))[1] = (select auth.uid())::text
          );
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage'
        AND policyname = 'Users can read own memory snapshots'
    ) THEN
        DROP POLICY IF EXISTS "Users can read own memory snapshots" ON storage.objects;
        CREATE POLICY "Users can read own memory snapshots" ON storage.objects
          FOR SELECT USING (
            bucket_id = 'memory-snapshots'
            AND (storage.foldername(name))[1] = (select auth.uid())::text
          );
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage'
        AND policyname = 'Users can update own memory snapshots'
    ) THEN
        DROP POLICY IF EXISTS "Users can update own memory snapshots" ON storage.objects;
        CREATE POLICY "Users can update own memory snapshots" ON storage.objects
          FOR UPDATE USING (
            bucket_id = 'memory-snapshots'
            AND (storage.foldername(name))[1] = (select auth.uid())::text
          );
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage'
        AND policyname = 'Users can delete own memory snapshots'
    ) THEN
        DROP POLICY IF EXISTS "Users can delete own memory snapshots" ON storage.objects;
        CREATE POLICY "Users can delete own memory snapshots" ON storage.objects
          FOR DELETE USING (
            bucket_id = 'memory-snapshots'
            AND (storage.foldername(name))[1] = (select auth.uid())::text
          );
    END IF;
END$$;

COMMENT ON SCHEMA public IS 'RLS policies optimized with SELECT subqueries to prevent per-row re-evaluation of auth functions';
