-- Migration: Add session locking RPC functions
-- Description: Adds acquire_session_lock and release_session_lock functions to prevent race conditions on session transcripts.

CREATE OR REPLACE FUNCTION acquire_session_lock(
  p_session_id uuid,
  p_lock_token uuid,
  p_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Attempt to acquire lock by updating metadata only if:
  -- 1. No lock exists (no _lock key)
  -- 2. OR Lock exists but has expired
  UPDATE sessions_v2
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{_lock}',
    jsonb_build_object('token', p_lock_token, 'expiresAt', p_expires_at)
  )
  WHERE id = p_session_id
    AND (
      NOT (metadata ? '_lock')
      OR (metadata->'_lock'->>'expiresAt') IS NULL
      OR (metadata->'_lock'->>'expiresAt')::timestamptz < NOW()
    );

  -- If UPDATE affected a row, we acquired the lock
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION release_session_lock(
  p_session_id uuid,
  p_lock_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Release lock only if we own it (token matches)
  UPDATE sessions_v2
  SET metadata = metadata - '_lock'
  WHERE id = p_session_id
    AND (metadata->'_lock'->>'token') = p_lock_token::text;

  RETURN FOUND;
END;
$$;
