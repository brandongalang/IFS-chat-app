-- Inbox observation action tracking
-- Migration: 109_inbox_observation_actions
-- Created: 2025-10-12
-- Feature: Inbox-to-Chat Bridge

-- Add columns to track user actions on inbox observations
alter table public.inbox_observations
  add column if not exists action_value text,
  add column if not exists action_timestamp timestamptz;

-- Add index for action_timestamp to support filtering by recent actions
create index if not exists inbox_observations_action_timestamp_idx
  on public.inbox_observations (user_id, action_timestamp desc)
  where action_timestamp is not null;

-- Add index for dismissed_at (already exists in table but may not have index)
create index if not exists inbox_observations_dismissed_at_idx
  on public.inbox_observations (user_id, dismissed_at desc)
  where dismissed_at is not null;

-- Update the status check constraint to include new statuses if not already present
-- Note: 'confirmed' and 'dismissed' already exist, this is defensive
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'inbox_observations_status_check'
    and conrelid = 'public.inbox_observations'::regclass
  ) then
    alter table public.inbox_observations
      add constraint inbox_observations_status_check
      check (status in ('pending', 'queued', 'confirmed', 'dismissed'));
  end if;
end
$$;

comment on column public.inbox_observations.action_value is 'Quick action value taken by user (agree_strong, agree, disagree, disagree_strong, etc.)';
comment on column public.inbox_observations.action_timestamp is 'Timestamp when user took the quick action';
