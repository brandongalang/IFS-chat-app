-- Migration to add usage tracking columns to the users table.

ALTER TABLE public.users
  ADD COLUMN daily_message_count INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN last_message_date TIMESTAMPTZ;

-- Add comments for the new columns for documentation purposes.
COMMENT ON COLUMN public.users.daily_message_count IS 'The number of messages the user has sent today (for usage limits).';
COMMENT ON COLUMN public.users.last_message_date IS 'The date of the user''s last message, used to reset the daily count.';
