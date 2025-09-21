-- Inbox MVP schema updates
-- Migration: 104_inbox_items_view
-- Created: 2025-09-21

alter table public.parts
  add column if not exists last_interaction_at timestamptz;

update public.parts
set last_interaction_at = coalesce(last_active, updated_at, created_at)
where last_interaction_at is null;

comment on column public.parts.last_interaction_at is 'Timestamp of the most recent user interaction used for Inbox follow-ups.';

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
where coalesce(p.last_interaction_at, p.updated_at, p.created_at) <= now() - interval '14 days';

grant select on public.inbox_items_view to authenticated;
grant select on public.inbox_items_view to service_role;

comment on view public.inbox_items_view is 'Unified inbox feed containing insight cards and part follow-up prompts for the Inbox MVP.';
