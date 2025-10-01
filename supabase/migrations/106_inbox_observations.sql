-- Inbox observation storage
-- Migration: 106_inbox_observations
-- Created: 2025-10-02

create table if not exists public.inbox_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'queued', 'confirmed', 'dismissed')),
  content jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  related_part_ids uuid[] not null default '{}'::uuid[],
  semantic_hash text,
  confidence double precision,
  timeframe_start timestamptz,
  timeframe_end timestamptz,
  created_at timestamptz not null default now(),
  queued_at timestamptz,
  confirmed_at timestamptz,
  dismissed_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists inbox_observations_user_hash_idx
  on public.inbox_observations (user_id, semantic_hash)
  where semantic_hash is not null;

create index if not exists inbox_observations_user_created_idx
  on public.inbox_observations (user_id, created_at desc);

create trigger update_inbox_observations_updated_at
before update on public.inbox_observations
for each row
execute function update_updated_at_column();

alter table public.inbox_observations enable row level security;

create policy if not exists "users_select_own_observations" on public.inbox_observations
  for select
  using (auth.uid() = user_id);

create policy if not exists "service_role_manage_observations" on public.inbox_observations
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

grant select on public.inbox_observations to authenticated;

create table if not exists public.observation_events (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.inbox_observations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('generated', 'queued', 'delivered', 'confirmed', 'dismissed', 'skipped', 'error')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists observation_events_observation_idx
  on public.observation_events (observation_id, event_type, created_at desc);

create index if not exists observation_events_user_idx
  on public.observation_events (user_id, created_at desc);

alter table public.observation_events enable row level security;

create policy if not exists "users_select_own_observation_events" on public.observation_events
  for select
  using (auth.uid() = user_id);

create policy if not exists "service_role_manage_observation_events" on public.observation_events
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

grant select on public.observation_events to authenticated;

create table if not exists public.inbox_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null default 'running' check (status in ('running', 'success', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  error jsonb,
  created_at timestamptz not null default now()
);

create index if not exists inbox_job_runs_name_idx
  on public.inbox_job_runs (job_name, started_at desc);

alter table public.inbox_job_runs enable row level security;

create policy if not exists "service_role_manage_inbox_jobs" on public.inbox_job_runs
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop view if exists public.inbox_items_view;

create view public.inbox_items_view as
select
  i.user_id,
  'insight'::text as source_type,
  i.id as source_id,
  i.status,
  i.content,
  null::uuid as part_id,
  coalesce(i.meta, '{}'::jsonb)
    || jsonb_build_object(
      'insight_type', i.type,
      'rating', i.rating,
      'revealed_at', i.revealed_at,
      'actioned_at', i.actioned_at
    ) as metadata,
  i.created_at
from public.insights i
where i.status in ('pending', 'revealed')

union all

select
  p.user_id,
  'part_follow_up'::text as source_type,
  p.id as source_id,
  'pending'::text as status,
  jsonb_build_object(
    'title', concat('Reconnect with ', p.name),
    'body', 'This part has not been interacted with for at least 14 days.',
    'kind', 'stale_part_follow_up'
  ) as content,
  p.id as part_id,
  jsonb_build_object(
    'last_interaction_at', p.last_interaction_at,
    'days_since_interaction', greatest(0, floor(extract(epoch from (now() - coalesce(p.last_interaction_at, p.updated_at, p.created_at))) / 86400)::int),
    'reason', 'stale_part_follow_up'
  ) as metadata,
  coalesce(p.last_interaction_at, p.updated_at, p.created_at) as created_at
from public.parts p
where coalesce(p.last_interaction_at, p.updated_at, p.created_at) <= now() - interval '14 days'

union all

select
  o.user_id,
  'observation'::text as source_type,
  o.id as source_id,
  o.status,
  o.content,
  null::uuid as part_id,
  coalesce(o.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'kind', 'observation',
      'insight_type', 'observation',
      'semantic_hash', o.semantic_hash,
      'confidence', o.confidence,
      'related_part_ids', o.related_part_ids,
      'timeframe_start', o.timeframe_start,
      'timeframe_end', o.timeframe_end,
      'queued_at', o.queued_at,
      'confirmed_at', o.confirmed_at,
      'dismissed_at', o.dismissed_at
    ) as metadata,
  o.created_at
from public.inbox_observations o
where o.status in ('pending', 'queued');

grant select on public.inbox_items_view to authenticated;
grant select on public.inbox_items_view to service_role;

comment on table public.inbox_observations is 'Generated inbox observations awaiting user confirmation.';
comment on table public.observation_events is 'Lifecycle events and audit trail for inbox observations.';
comment on table public.inbox_job_runs is 'Execution log for scheduled inbox jobs and cron tasks.';
comment on view public.inbox_items_view is 'Unified inbox feed containing insight cards, part follow-ups, and generated observations.';
