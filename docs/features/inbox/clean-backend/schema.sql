-- Inbox message tables (normalized)
create type inbox_message_type as enum ('insight_spotlight', 'nudge', 'cta', 'notification');

create table if not exists inbox_message_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type inbox_message_type not null,
  priority int2 not null default 5,
  tags text[] default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists inbox_message_payloads (
  subject_id uuid primary key references inbox_message_subjects(id) on delete cascade,
  headline text,
  summary text,
  detail jsonb not null default '{}'::jsonb,
  cta jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists inbox_message_events (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references inbox_message_subjects(id) on delete cascade,
  user_id uuid not null,
  event_type text not null check (event_type in ('delivered', 'opened', 'dismissed', 'cta_clicked')),
  occurred_at timestamptz not null default now(),
  attributes jsonb not null default '{}'::jsonb
);

create index if not exists idx_inbox_subject_user_priority
  on inbox_message_subjects (user_id, priority desc, created_at desc);

create index if not exists idx_inbox_events_subject
  on inbox_message_events (subject_id, occurred_at desc);

create policy "Users can view own inbox subjects"
  on inbox_message_subjects
  for select using (auth.uid() = user_id);

create policy "Users manage own inbox payloads"
  on inbox_message_payloads
  using (auth.uid() = (select user_id from inbox_message_subjects s where s.id = subject_id));

create policy "Users can insert reaction events"
  on inbox_message_events
  for insert with check (auth.uid() = user_id);

alter table inbox_message_subjects enable row level security;
alter table inbox_message_payloads enable row level security;
alter table inbox_message_events enable row level security;
