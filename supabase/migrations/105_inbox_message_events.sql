-- Inbox analytics ledger
-- Migration: 105_inbox_message_events
-- Created: 2025-10-01

create table if not exists public.inbox_message_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null,
  envelope_type text not null,
  source_type text not null,
  event_type text not null check (event_type in ('delivered', 'opened', 'actioned')),
  action_value text,
  notes text,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

default privileges in schema public
  grant select, insert on tables to authenticated;

default privileges in schema public
  grant usage, select on sequences to authenticated;

alter table public.inbox_message_events enable row level security;

create policy "users_insert_inbox_events" on public.inbox_message_events
  for insert
  with check (auth.uid() = user_id);

create policy "users_select_own_inbox_events" on public.inbox_message_events
  for select
  using (auth.uid() = user_id);

create index if not exists inbox_message_events_user_subject_idx
  on public.inbox_message_events (user_id, subject_id, event_type, created_at desc);

create unique index if not exists inbox_message_events_unique_delivery
  on public.inbox_message_events (user_id, subject_id, event_type)
  where event_type = 'delivered';

comment on table public.inbox_message_events is 'Durable inbox interaction events (delivered, opened, actioned).';
