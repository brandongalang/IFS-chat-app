-- Migration: 108_memory_updates_ref_id
-- Adds a ref_id column to memory_updates for idempotent queue operations
-- and introduces supporting indexes.

alter table if exists public.memory_updates
  add column if not exists ref_id text;

-- Backfill existing rows so legacy data has deterministic identifiers.
update public.memory_updates
  set ref_id = coalesce(ref_id, id::text)
  where ref_id is null;

alter table if exists public.memory_updates
  alter column ref_id set not null;

create unique index if not exists idx_memory_updates_user_kind_ref
  on public.memory_updates(user_id, kind, ref_id);

create index if not exists idx_memory_updates_pending_user_kind
  on public.memory_updates(user_id, kind)
  where processed_at is null;
