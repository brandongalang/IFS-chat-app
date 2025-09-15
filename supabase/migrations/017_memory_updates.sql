-- Memory v2: queue of raw updates awaiting summarization

create table if not exists public.memory_updates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null,
  payload jsonb not null,
  summary text null,
  created_at timestamptz not null default now(),
  processed_at timestamptz null,
  processed_digest text null,
  processed_summary text null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_memory_updates_user_created
  on public.memory_updates(user_id, created_at desc);

create index if not exists idx_memory_updates_pending
  on public.memory_updates(user_id, created_at)
  where processed_at is null;

alter table public.memory_updates enable row level security;

create policy "Users can view own memory updates"
  on public.memory_updates for select
  using (auth.uid() = user_id);

