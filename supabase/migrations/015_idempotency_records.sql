-- Memory v2: idempotency records for safe retries

create table if not exists public.idempotency_records (
  id bigserial primary key,
  scope_hash text unique not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  outcome jsonb null
);

create index if not exists idx_idem_expires_at on public.idempotency_records(expires_at);

-- RLS: internal-only; no policies mean only service role can access
alter table public.idempotency_records enable row level security;

