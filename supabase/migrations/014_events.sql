-- Memory v2: events ledger (clean-slate)
-- This migration creates the append-only events table used by the agentic file-first system.

create table if not exists public.events (
  event_id text primary key,
  schema_version int not null default 1,
  ts timestamptz not null default now(),
  user_id uuid not null,
  entity_type text not null check (entity_type in ('user','part','relationship','note')),
  entity_id uuid null,
  type text not null check (type in ('observation','action','profile_update','system','audit')),
  op text null check (op in ('replace_section','append_section','append_item','curate_items','tombstone_section')),
  section_anchor text null,
  file_path text null,
  rationale text null,
  before_hash text null,
  after_hash text null,
  evidence_refs jsonb not null default '[]'::jsonb,
  lint jsonb not null default '{}'::jsonb,
  idempotency_key text null,
  transaction_id text null,
  tool_call_id text null,
  agent_action_id uuid null,
  integrity_line_hash text not null,
  integrity_salt_version text not null default 'v1',
  status text not null default 'committed' check (status in ('pending','committed','failed'))
);

-- Indexes for common access paths
create index if not exists idx_events_user_ts on public.events(user_id, ts desc);
create index if not exists idx_events_entity_ts on public.events(user_id, entity_type, entity_id, ts desc);
create index if not exists idx_events_transaction_id on public.events(transaction_id);
create index if not exists idx_events_tool_call_id on public.events(tool_call_id);
create index if not exists idx_events_agent_action_id on public.events(agent_action_id);
create index if not exists idx_events_type_ts on public.events(type, ts desc);
create index if not exists idx_events_evidence_gin on public.events using gin (evidence_refs);
create index if not exists idx_events_lint_gin on public.events using gin (lint);

-- RLS: owner-only reads; writes via service role (no insert/update policies provided)
alter table public.events enable row level security;
create policy "Users can view own events"
  on public.events for select
  using (user_id = auth.uid());

