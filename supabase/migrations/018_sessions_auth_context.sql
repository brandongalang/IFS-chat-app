-- Ensure sessions automatically scope to the authenticated user
ALTER TABLE sessions
  ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE OR REPLACE FUNCTION set_session_user_id()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth.uid() must be set to insert into sessions';
  END IF;
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_session_user_id ON sessions;

CREATE TRIGGER set_session_user_id
BEFORE INSERT ON sessions
FOR EACH ROW
EXECUTE FUNCTION set_session_user_id();

DROP POLICY IF EXISTS "Users can insert own sessions" ON sessions;

CREATE POLICY "Authenticated users can insert sessions"
  ON sessions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
